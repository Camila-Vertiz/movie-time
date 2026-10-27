import { load } from "cheerio";
import type { CinemaScraper, ScraperContext } from "./types";
import type { Cinema, Movie, ScrapeResult, Showtime } from "../src/domain/models";
import { parseClock, parseSpanishDay, safeUrl, stableId } from "./shared/normalize";

export class MagalyScraper implements CinemaScraper {
  readonly id = "magaly";
  readonly name = "Cine Magaly";
  readonly url = "https://www.cinemagaly.com/";
  readonly maturity = "dom-verified" as const;

  async scrape(context: ScraperContext): Promise<ScrapeResult> {
    const page = await context.browser.newPage();
    const cinema: Cinema = { id: "magaly-san-jose", cadena: this.id, nombre: this.name, direccion: "Barrio La California, San José", url: this.url };
    const movies: Movie[] = [];
    const showtimes: Showtime[] = [];
    try {
      await context.navigate(page, this.url);
      const links = [...new Set(await page.locator('a[href*="/pelicula/"]').evaluateAll((elements) => elements.map((element) => (element as HTMLAnchorElement).href)))];
      if (links.length > 60) throw new Error("Unexpected movie count; review source before truncating");
      for (const link of links) {
        if (new URL(link).origin !== new URL(this.url).origin) continue;
        await context.navigate(page, link);
        const $ = load(await page.content());
        const titulo = $("h1").first().text().trim();
        if (!titulo) throw new Error("Missing movie title; DOM changed");
        const id = stableId("movie", titulo);
        const metadata = $("h1").first().next().text();
        const duration = metadata.match(/(\d+)\s*Min/i);
        movies.push({ id, titulo, genero: $(".genres").first().text().trim() || null,
          duracion: duration && Number(duration[1]) > 0 ? Number(duration[1]) : null,
          posterUrl: safeUrl($('img[alt^="Poster de la película"]').first().attr("src"), link),
          backdropUrl: null, sinopsis: $("h3").filter((_, element) => $(element).text().trim() === "Sinopsis").next("p").text().trim() || null,
          fechaEstreno: null, proximoEstreno: false, fechaActualizacion: new Date().toISOString() });
        if (!await page.locator("select#date").count()) continue;
        const options = await page.locator("select#date option").evaluateAll((elements) => elements.map((element) => ({ value: (element as HTMLOptionElement).value, label: element.textContent ?? "" })));
        for (const option of options) {
          const fecha = parseSpanishDay(option.label);
          if (!fecha) throw new Error(`Unrecognized show date: ${option.label.trim()}`);
          const current = await page.locator("select#date").inputValue();
          if (current !== option.value) {
            const response = page.waitForResponse((result) => new URL(result.url()).origin === new URL(this.url).origin && ["xhr", "fetch"].includes(result.request().resourceType()), { timeout: 20_000 });
            await page.selectOption("select#date", option.value);
            const updated = await response;
            if (!updated.ok()) throw new Error("Showtime request failed");
            await page.waitForLoadState("networkidle", { timeout: 15_000 });
          }
          const screenings = await page.locator('#screeningsContainer a[href*="/seleccionar/"]').evaluateAll((elements) => elements.map((element) => ({ text: element.textContent?.trim() ?? "", url: (element as HTMLAnchorElement).href })));
          for (const screening of screenings) {
            const match = screening.text.match(/^(.*?)\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))$/i);
            const hora = match ? parseClock(match[2]) : null;
            if (!match || !hora) {
              throw new Error(`Unrecognized screening label: ${JSON.stringify(screening.text.slice(0, 120))}`);
            }
            if (new URL(screening.url).origin !== new URL(this.url).origin) {
              throw new Error("Screening link redirected to a different origin");
            }
            const sala = match[1].trim();
            showtimes.push({ id: stableId(this.id, id, fecha, hora, sala), movieId: id, cinemaId: cinema.id, fecha, hora, sala,
              precio: null, formato: null, idioma: null, sourceUrl: screening.url });
          }
        }
      }
      return { cadena: this.id, movies, cinemas: [cinema], showtimes };
    } finally { await page.close(); }
  }
}