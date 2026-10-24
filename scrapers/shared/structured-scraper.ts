import { load } from "cheerio";
import type { CinemaScraper, ScraperContext } from "../types";
import type { Cinema, Movie, ScrapeResult, Showtime } from "../../src/domain/models";
import { localDate, TIME_ZONE } from "../../src/lib/dates";
import { safeUrl, stableId } from "./normalize";

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;

function nodes(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  const record = object(value);
  return record ? [record, ...Object.values(record).flatMap(nodes)] : [];
}

export function parseStructuredEvents(html: string, cadena: string, sourceUrl: string): ScrapeResult {
  const $ = load(html);
  const entries: JsonObject[] = [];
  $('script[type="application/ld+json"]').each((_, script) => {
    try { entries.push(...nodes(JSON.parse($(script).text()))); } catch { return; }
  });
  const references = new Map(entries.filter((entry) => text(entry["@id"])).map((entry) => [String(entry["@id"]), entry]));
  const resolve = (value: unknown): JsonObject | null => {
    const record = object(value);
    return record && text(record["@id"]) ? references.get(String(record["@id"])) ?? record : record;
  };
  const hasType = (entry: JsonObject, type: string) => (Array.isArray(entry["@type"]) ? entry["@type"] : [entry["@type"]]).includes(type);
  const movies = new Map<string, Movie>();
  const cinemas = new Map<string, Cinema>();
  const showtimes = new Map<string, Showtime>();
  for (const event of entries.filter((entry) => hasType(entry, "ScreeningEvent"))) {
    const film = resolve(event.workPresented);
    const location = resolve(event.location);
    const start = text(event.startDate);
    const titulo = text(film?.name);
    const cinemaName = text(location?.name);
    if (!film || !hasType(film, "Movie") || !titulo || !location || !cinemaName || !start || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(start)) continue;
    const instant = new Date(/[Zz]|[+-]\d{2}:\d{2}$/.test(start) ? start : `${start}-06:00`);
    if (Number.isNaN(instant.getTime())) continue;
    const fecha = localDate(instant);
    if (fecha < localDate()) continue;
    const hora = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(instant);
    const movieId = stableId("movie", titulo);
    const cinemaId = stableId(cadena, cinemaName);
    const address = object(location.address);
    const image = typeof film.image === "string" ? film.image : Array.isArray(film.image) ? film.image[0] : object(film.image)?.url;
    const duration = text(film.duration)?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/);
    const durationMinutes = duration ? Number(duration[1] ?? 0) * 60 + Number(duration[2] ?? 0) : null;
    movies.set(movieId, { id: movieId, titulo, genero: Array.isArray(film.genre) ? film.genre.filter((item) => typeof item === "string").join(", ") || null : text(film.genre),
      duracion: durationMinutes && durationMinutes > 0 ? durationMinutes : null, posterUrl: safeUrl(text(image) ?? undefined, sourceUrl),
      backdropUrl: null, sinopsis: text(film.description), fechaEstreno: null, proximoEstreno: false, fechaActualizacion: new Date().toISOString() });
    cinemas.set(cinemaId, { id: cinemaId, cadena, nombre: cinemaName,
      direccion: text(location.address) ?? [text(address?.streetAddress), text(address?.addressLocality)].filter(Boolean).join(", "), url: sourceUrl });
    const offer = object(Array.isArray(event.offers) ? event.offers[0] : event.offers);
    const price = offer?.priceCurrency === "CRC" && offer.price !== undefined ? Number(offer.price) : null;
    const source = safeUrl(text(event.url) ?? undefined, sourceUrl) ?? sourceUrl;
    const id = stableId(cadena, movieId, cinemaId, fecha, hora, text(event.locationName) ?? "");
    showtimes.set(id, { id, movieId, cinemaId, fecha, hora, sala: text(event.locationName),
      precio: price !== null && Number.isFinite(price) && price >= 0 ? price : null, formato: text(event.videoFormat), idioma: text(event.inLanguage),
      sourceUrl: new URL(source).origin === new URL(sourceUrl).origin ? source : sourceUrl });
  }
  return { cadena, movies: [...movies.values()], cinemas: [...cinemas.values()], showtimes: [...showtimes.values()] };
}

export abstract class StructuredScraper implements CinemaScraper {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly url: string;
  abstract readonly movieLinkSelector: string;
  readonly maturity = "experimental" as const;

  async scrape(context: ScraperContext): Promise<ScrapeResult> {
    const page = await context.browser.newPage();
    const movies = new Map<string, Movie>();
    const cinemas = new Map<string, Cinema>();
    const showtimes = new Map<string, Showtime>();
    const collect = async () => {
      const result = parseStructuredEvents(await page.content(), this.id, page.url());
      result.movies.forEach((movie) => movies.set(movie.id, movie));
      result.cinemas.forEach((cinema) => cinemas.set(cinema.id, cinema));
      result.showtimes.forEach((showtime) => showtimes.set(showtime.id, showtime));
    };
    try {
      await context.navigate(page, this.url);
      await collect();
      const links = [...new Set(await page.locator(this.movieLinkSelector).evaluateAll((elements) => elements.map((element) => (element as HTMLAnchorElement).href)))];
      if (links.length > 60) throw new Error("Unexpected link count; refusing a truncated snapshot");
      for (const link of links) {
        if (new URL(link).origin !== new URL(this.url).origin) continue;
        await context.navigate(page, link);
        await collect();
      }
      if (!showtimes.size) throw new Error("No verified ScreeningEvent data. This experimental adapter needs a site-specific schedule parser; previous data preserved.");
      return { cadena: this.id, movies: [...movies.values()], cinemas: [...cinemas.values()], showtimes: [...showtimes.values()] };
    } finally { await page.close(); }
  }
}