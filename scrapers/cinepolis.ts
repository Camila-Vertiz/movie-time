import { load } from "cheerio";
import type { CinemaScraper, ScraperContext } from "./types";
import type { Cinema, Movie, ScrapeResult, Showtime } from "../src/domain/models";
import { localDate } from "../src/lib/dates";
import { safeUrl, stableId } from "./shared/normalize";

const BASE_URL = "https://cinepolis.co.cr/";

async function closeWelcomeVideoIfVisible(page: import("playwright").Page): Promise<void> {
  const popup = page.locator(".welcome-video-popup");
  if (!await popup.isVisible()) return;

  await popup.locator(".button-close").click();
  await popup.waitFor({ state: "hidden" });
}

export function parseCinepolisCinemaPage(html: string, cinemaUrl: string, expectedDate?: string): ScrapeResult {
  const $ = load(html);
  const cinemaName = $("#form-reservation .step-title").first().text().replace(/^Cine:\s*/i, "").trim();
  const slug = new URL(cinemaUrl).pathname.split("/").filter(Boolean).at(-1);
  if (!cinemaName || !slug) throw new Error("Cinépolis cinema page did not contain a valid cinema title");

  const cinemaId = stableId("cinepolis", slug);
  const cinema: Cinema = {
    id: cinemaId,
    cadena: "cinepolis",
    nombre: cinemaName,
    direccion: "",
    url: cinemaUrl,
  };
  const movies = new Map<string, Movie>();
  const showtimes: Showtime[] = [];

  $(".movie-projection").each((_, element) => {
    const card = $(element);
    const link = card.find(".movie-projection__inner > a").first();
    const title = link.find("h2").first().text().trim();
    const movieUrl = safeUrl(link.attr("href"), cinemaUrl);
    if (!title || !movieUrl || new URL(movieUrl).origin !== new URL(BASE_URL).origin) return;

    const movieId = stableId("movie", title);
    const meta = link.find(".movie-projection__inner--meta").text();
    const duration = meta.match(/(\d+)\s*Minutos?/i);
    const posterUrl = safeUrl(link.find("img").first().attr("src"), cinemaUrl);
    movies.set(movieId, {
      id: movieId,
      titulo: title,
      genero: null,
      duracion: duration ? Number(duration[1]) : null,
      posterUrl,
      backdropUrl: null,
      sinopsis: null,
      fechaEstreno: null,
      proximoEstreno: false,
      fechaActualizacion: new Date().toISOString(),
    });

    card.find('input[name="field-projection"]').each((__, input) => {
      const date = $(input).attr("data-show-date");
      const time = $(input).attr("data-show-time");
      if (!date || !time) {
        throw new Error(`Cinépolis showtime is missing its date or time for "${title}"`);
      }
      if (expectedDate && date !== expectedDate) return;
      const format = $(input).attr("data-format")?.trim() || null;
      const room = $(input).attr("data-room")?.trim() || null;
      showtimes.push({
        id: stableId("cinepolis", movieId, cinemaId, date, time, format ?? "", room ?? ""),
        movieId,
        cinemaId,
        fecha: date,
        hora: time,
        sala: room,
        precio: null,
        formato: format,
        idioma: format?.includes("SUBTITLE") ? "Subtitulada" : format?.includes("DOB") ? "Doblada" : null,
        sourceUrl: movieUrl,
      });
    });
  });

  return { cadena: "cinepolis", movies: [...movies.values()], cinemas: [cinema], showtimes };
}

export class CinepolisScraper implements CinemaScraper {
  readonly id = "cinepolis";
  readonly name = "Cinépolis Costa Rica";
  readonly url = BASE_URL;
  readonly maturity = "dom-verified" as const;

  async scrape(context: ScraperContext): Promise<ScrapeResult> {
    const page = await context.browser.newPage();
    const movies = new Map<string, Movie>();
    const cinemas = new Map<string, Cinema>();
    const showtimes = new Map<string, Showtime>();

    try {
      await context.navigate(page, this.url);
      await closeWelcomeVideoIfVisible(page);
      await page.locator("a.show-cinemas-popup").first().click();
      const cinemaLinks = await page.locator('#popup-cinemas a[href*="/cinema/"]').evaluateAll((anchors) =>
        anchors.map((anchor) => (anchor as HTMLAnchorElement).href)
          .filter((href) => !new URL(href).pathname.endsWith("/all/")),
      );
      const uniqueCinemaLinks = [...new Set(cinemaLinks)];
      if (!uniqueCinemaLinks.length || uniqueCinemaLinks.length > 30) {
        throw new Error(`Unexpected Cinépolis cinema count: ${uniqueCinemaLinks.length}`);
      }

      for (const cinemaUrl of uniqueCinemaLinks) {
        if (new URL(cinemaUrl).origin !== new URL(this.url).origin) continue;
        await context.navigate(page, cinemaUrl);
        await page.locator("#form-reservation").waitFor();

        const dates = await page.locator('input[name="field-movie-date"]').evaluateAll((inputs, today) =>
          inputs.map((input) => (input as HTMLInputElement).value)
            .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today),
          localDate(),
        );
        if (!dates.length) throw new Error(`No schedule dates found for ${cinemaUrl}`);

        for (const date of [...new Set(dates)]) {
          const checkedDate = await page.locator('input[name="field-movie-date"]:checked').getAttribute("value");
          if (checkedDate !== date) {
            await page.locator(`label[for="field-movie-date-${date}"]`).click({ force: true });
            await page.waitForFunction(
              (selectedDate) => document.querySelector<HTMLInputElement>('input[name="field-movie-date"]:checked')?.value === selectedDate,
              date,
            );
            await page.waitForTimeout(1_500);
          }

          const result = parseCinepolisCinemaPage(await page.content(), cinemaUrl, date);
          result.movies.forEach((movie) => movies.set(movie.id, movie));
          result.cinemas.forEach((cinema) => cinemas.set(cinema.id, cinema));
          result.showtimes.forEach((showtime) => showtimes.set(showtime.id, showtime));
        }
      }

      if (!showtimes.size) throw new Error("Cinépolis returned no verified showtimes; previous data preserved.");
      return { cadena: this.id, movies: [...movies.values()], cinemas: [...cinemas.values()], showtimes: [...showtimes.values()] };
    } finally {
      await page.close();
    }
  }
}
