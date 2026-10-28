import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCinepolisCinemaPage } from "../scrapers/cinepolis";
import { parseGarbo } from "../scrapers/garbo";
import { parseMagalyScreeningLabel } from "../scrapers/magaly";
import { parseStructuredEvents } from "../scrapers/shared/structured-scraper";
import { parseClock, parseGarboDate, parseSpanishDay, safeUrl, stableId } from "../scrapers/shared/normalize";
import { getEnabledScrapers } from "../scrapers/registry";
import { addDays, localDate } from "../src/lib/dates";
import { validateScrapeResult } from "../src/domain/models";
import { filterShowtimes, rankMovies } from "../src/application/catalog-service";
import { getDemoCatalog } from "../src/infrastructure/demo-catalog";

test("normalization validates clocks, dates, URLs and stable canonical titles", () => {
  assert.equal(parseClock("6:40 PM"), "18:40");
  assert.equal(parseClock("12:00 AM"), "00:00");
  assert.equal(parseClock("29:00"), null);
  assert.equal(parseClock("00:15 PM"), null);
  assert.deepEqual(parseGarboDate("23 Oct 2026, 19:30"), { fecha: "2026-10-23", hora: "19:30" });
  assert.equal(parseGarboDate("30 Feb 2026, 19:30"), null);
  assert.equal(parseSpanishDay("(HOY) VIERNES 23 OCTUBRE", "2026-10-23"), "2026-10-23");
  assert.equal(parseSpanishDay("JUEVES 1 ENERO", "2026-12-31"), "2027-01-01");
  assert.equal(parseSpanishDay("1 JULIO", "2026-10-23"), null);
  assert.equal(safeUrl("javascript:alert(1)", "https://salagarbo.com"), null);
  assert.equal(stableId("movie", "Película: DOS"), stableId("movie", "Pelicula dos"));
});

test("Garbo parser extracts only explicit showtimes and nullable metadata", () => {
  const tomorrow = addDays(localDate(), 1);
  const [year, month, day] = tomorrow.split("-");
  const monthName = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(month) - 1];
  const html = `<div class="sg-row"><img class="sg-product-list-img" src="/poster.webp"><div class="sg-product-info-wrapper"><a href="/product/film/"><h2>Film</h2></a><p class="sg-product-detail-entry"><span class="woocommerce-Price-amount">₡3,000</span></p><div class="sg-product-detail-entry">Sinopsis.</div><div class="event-purchase-line"><div class="event-purchase-element">${day} ${monthName} ${year}, 19:30</div></div></div></div>`;
  const result = validateScrapeResult(parseGarbo(html));
  assert.equal(result.movies[0].titulo, "Film");
  assert.equal(result.movies[0].duracion, null);
  assert.equal(result.showtimes[0].fecha, tomorrow);
  assert.equal(result.showtimes[0].precio, 3000);
  assert.equal(result.showtimes[0].sourceUrl, "https://salagarbo.com/product/film/");
  assert.equal(parseGarbo("<h1>Maintenance</h1>").showtimes.length, 0);
});

test("Magaly screening labels allow an optional language suffix", () => {
  assert.deepEqual(parseMagalyScreeningLabel("La Salita - 1:00 PM (Doblada al español)"), {
    sala: "La Salita",
    hora: "13:00",
    idioma: "Doblada al español",
  });
  assert.deepEqual(parseMagalyScreeningLabel("Sala 2 - 6:40 PM"), {
    sala: "Sala 2",
    hora: "18:40",
    idioma: null,
  });
  assert.equal(parseMagalyScreeningLabel("La Salita - horario no disponible"), null);
});

test("Cinépolis parser extracts cinema schedule fields from the visible schedule DOM", () => {
  const html = `<form id="form-reservation">
    <h3 class="step-title">Cine: Cinépolis TerraMall</h3>
    <div class="movie-projection">
      <div class="movie-projection__inner">
        <a href="https://cinepolis.co.cr/movie/film/?cinema=1627">
          <img src="/poster.jpg"><h2>Film</h2>
          <span class="movie-projection__inner--meta">TP | 107 Minutos | 2D</span>
        </a>
      </div>
      <ul><li><input name="field-projection" data-show-date="2026-10-28" data-show-time="18:05" data-format="DOB 2D" data-room="SALA 11"></li></ul>
    </div>
  </form>`;
  const result = validateScrapeResult(parseCinepolisCinemaPage(html, "https://cinepolis.co.cr/cinema/cinepolis-terramall/"));
  assert.equal(result.cinemas[0].nombre, "Cinépolis TerraMall");
  assert.equal(result.movies[0].titulo, "Film");
  assert.equal(result.movies[0].duracion, 107);
  assert.equal(result.movies[0].posterUrl, "https://cinepolis.co.cr/poster.jpg");
  assert.equal(result.showtimes[0].fecha, "2026-10-28");
  assert.equal(result.showtimes[0].hora, "18:05");
  assert.equal(result.showtimes[0].formato, "DOB 2D");
  assert.equal(result.showtimes[0].idioma, "Doblada");
  assert.equal(result.showtimes[0].sala, "SALA 11");
  assert.equal(parseCinepolisCinemaPage(html, "https://cinepolis.co.cr/cinema/cinepolis-terramall/", "2026-10-29").showtimes.length, 0);
});

test("JSON-LD requires a ScreeningEvent with movie, location and explicit date", () => {
  const day = addDays(localDate(), 1);
  const event = { "@type": "ScreeningEvent", startDate: `${day}T01:00:00Z`, workPresented: { "@type": "Movie", name: "Film", duration: "PT1H45M" }, location: { "@type": "MovieTheater", name: "Cinema", address: { streetAddress: "Avenida 2" } }, offers: { price: "4500", priceCurrency: "CRC" } };
  const result = validateScrapeResult(parseStructuredEvents(`<script type="application/ld+json">${JSON.stringify(event)}</script>`, "source", "https://example.org/"));
  assert.equal(result.movies[0].duracion, 105);
  assert.equal(result.showtimes[0].hora, "19:00");
  assert.equal(result.showtimes[0].fecha, addDays(day, -1));
  assert.equal(parseStructuredEvents('<script type="application/ld+json">{"@type":"Movie","name":"Film"}</script>', "source", "https://example.org/").showtimes.length, 0);
});

test("registry is opt-in and rejects unknown sources", () => {
  assert.throws(() => getEnabledScrapers(""), /No sources/);
  assert.throws(() => getEnabledScrapers("unknown"), /Unknown source/);
  assert.deepEqual(getEnabledScrapers("garbo,magaly").map((scraper) => scraper.id).sort(), ["garbo", "magaly"]);
});

test("catalog filters intersect and ranking is based on actual show counts", () => {
  const catalog = getDemoCatalog();
  const show = catalog.showtimes[0];
  const filtered = filterShowtimes(catalog, { cinema: show.cinemaId, movie: show.movieId, date: show.fecha });
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((item) => item.cinemaId === show.cinemaId && item.movieId === show.movieId && item.fecha === show.fecha));
  assert.equal(filterShowtimes(catalog, { q: "nonexistent title" }).length, 0);
  const ranking = rankMovies(catalog.movies, catalog.showtimes);
  assert.ok(ranking[0].funciones >= ranking[1].funciones);
  assert.equal(ranking[0].funciones, catalog.showtimes.filter((item) => item.movieId === ranking[0].id).length);
});