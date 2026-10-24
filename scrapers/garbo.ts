import { load } from "cheerio";
import type { CinemaScraper, ScraperContext } from "./types";
import type { Cinema, Movie, ScrapeResult, Showtime } from "../src/domain/models";
import { localDate } from "../src/lib/dates";
import { parseGarboDate, safeUrl, stableId } from "./shared/normalize";

export function parseGarbo(html: string, sourceUrl = "https://salagarbo.com/cartelera/"): ScrapeResult {
  const $ = load(html);
  const cinema: Cinema = { id: "garbo-san-jose", cadena: "garbo", nombre: "Sala Garbo", direccion: "Avenida 2, calle 28, San José", url: sourceUrl };
  const movies: Movie[] = [];
  const showtimes: Showtime[] = [];
  $(".sg-row").each((_, element) => {
    const card = $(element);
    const titulo = card.find("h2").first().text().trim();
    const url = safeUrl(card.find("h2").first().closest("a").attr("href"), sourceUrl);
    if (!titulo || !url || new URL(url).origin !== new URL(sourceUrl).origin) return;
    const id = stableId("movie", titulo);
    const synopsis = card.find("div.sg-product-detail-entry").filter((_, entry) => !$(entry).find("p,ul").length).first().text().trim();
    const categories = card.find('a[rel="tag"]').map((_, item) => $(item).text().trim()).get();
    const genero = categories.find((value) => ["Documental", "Musical", "Animación", "Drama", "Terror", "Comedia"].includes(value)) ?? null;
    movies.push({ id, titulo, genero, duracion: null, posterUrl: safeUrl(card.find("img.sg-product-list-img").attr("src"), sourceUrl),
      backdropUrl: null, sinopsis: synopsis || null, fechaEstreno: null, proximoEstreno: false, fechaActualizacion: new Date().toISOString() });
    const priceText = card.find("p.sg-product-detail-entry .woocommerce-Price-amount").first().text();
    const parsedPrice = priceText ? Number(priceText.replace(/[^\d]/g, "")) : null;
    card.find(".event-purchase-line").each((_, entry) => {
      const date = parseGarboDate($(entry).find(".event-purchase-element").first().text());
      if (!date || date.fecha < localDate()) return;
      showtimes.push({ id: stableId("garbo", id, cinema.id, date.fecha, date.hora), movieId: id, cinemaId: cinema.id, ...date,
        sala: null, precio: parsedPrice, formato: null, idioma: null, sourceUrl: url });
    });
  });
  return { cadena: "garbo", movies, cinemas: [cinema], showtimes };
}

export class GarboScraper implements CinemaScraper {
  readonly id = "garbo";
  readonly name = "Sala Garbo";
  readonly url = "https://salagarbo.com/cartelera/";
  readonly maturity = "dom-verified" as const;
  async scrape(context: ScraperContext): Promise<ScrapeResult> {
    const page = await context.browser.newPage();
    try {
      await context.navigate(page, this.url);
      await page.locator(".sg-row").first().waitFor();
      return parseGarbo(await page.content(), this.url);
    } finally { await page.close(); }
  }
}