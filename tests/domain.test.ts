import assert from "node:assert/strict";
import { test } from "node:test";
import { localDate, addDays, displayTime } from "../src/lib/dates";
import { validateScrapeResult } from "../src/domain/models";

test("Costa Rica dates do not switch at UTC midnight", () => {
   assert.equal(localDate(new Date("2026-10-24T02:00:00Z")), "2026-10-23");
   assert.equal(addDays("2026-12-31", 1), "2027-01-01");
   assert.equal(displayTime("00:15"), "12:15 a. m.");
   assert.equal(displayTime("19:30"), "7:30 p. m.");
});

const result = () => ({
   cadena: "garbo",
   movies: [{ id: "movie", titulo: "Film", genero: null, duracion: null, posterUrl: null, fechaActualizacion: new Date().toISOString() }],
   cinemas: [{ id: "garbo", cadena: "garbo", nombre: "Garbo", direccion: "San Jose", url: "https://salagarbo.com/" }],
   showtimes: [{ id: "show", movieId: "movie", cinemaId: "garbo", fecha: "2026-10-23", hora: "19:30", sala: null, precio: null, sourceUrl: "https://salagarbo.com/" }],
});

test("validates real schedules and rejects orphaned or empty snapshots", () => {
   assert.equal(validateScrapeResult(result()).showtimes.length, 1);
   const orphan = result();
   orphan.showtimes[0].cinemaId = "unknown";
   assert.throws(() => validateScrapeResult(orphan), /Orphan/);
   assert.throws(() => validateScrapeResult({ ...result(), showtimes: [] }), /No verified/);
});

test("rejects invalid dates, times and cross-source cinemas", () => {
   const invalid = result();
   invalid.showtimes[0].hora = "25:99";
   assert.throws(() => validateScrapeResult(invalid));
   invalid.showtimes[0].hora = "19:30";
   invalid.showtimes[0].fecha = "2026-02-30";
   assert.throws(() => validateScrapeResult(invalid));
   const wrongOwner = result();
   wrongOwner.cinemas[0].cadena = "other";
   assert.throws(() => validateScrapeResult(wrongOwner), /ownership/);
});