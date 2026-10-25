import { z } from "zod";

export const movieSchema = z.object({
   id: z.string().min(1),
   titulo: z.string().min(1),
   genero: z.string().nullable(),
   duracion: z.number().int().positive().nullable(),
   posterUrl: z.string().url().nullable(),
   backdropUrl: z.string().url().nullable().default(null),
   sinopsis: z.string().nullable().default(null),
   fechaEstreno: z.string().date().nullable().default(null),
   proximoEstreno: z.boolean().default(false),
   fechaActualizacion: z.string().datetime({ offset: true }),
});

export const cinemaSchema = z.object({
   id: z.string().min(1),
   cadena: z.string().min(1),
   nombre: z.string().min(1),
   direccion: z.string(),
   url: z.string().url(),
});

export const showtimeSchema = z.object({
   id: z.string().min(1),
   movieId: z.string().min(1),
   cinemaId: z.string().min(1),
   fecha: z.string().date(),
   hora: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
   sala: z.string().nullable(),
   precio: z.number().nonnegative().nullable(),
   formato: z.string().nullable().default(null),
   idioma: z.string().nullable().default(null),
   sourceUrl: z.string().url(),
});

export type Movie = z.infer<typeof movieSchema>;
export type Cinema = z.infer<typeof cinemaSchema>;
export type Showtime = z.infer<typeof showtimeSchema>;

export interface SourceStatus {
   cadena: string;
   estado: "ok" | "error" | "pendiente";
   ultimaEjecucion: string | null;
   ultimoExito: string | null;
   mensaje: string | null;
}

export interface Catalog {
   movies: Movie[];
   cinemas: Cinema[];
   showtimes: Showtime[];
   sources: SourceStatus[];
   mode: "demo" | "live";
   updatedAt: string | null;
}

export const scrapeResultSchema = z.object({
   cadena: z.string().min(1),
   movies: z.array(movieSchema).min(1),
   cinemas: z.array(cinemaSchema).min(1),
   showtimes: z.array(showtimeSchema),
});

export type ScrapeResult = z.infer<typeof scrapeResultSchema>;

export function validateScrapeResult(input: unknown): ScrapeResult {
   const result = scrapeResultSchema.parse(input);
   const movies = new Set(result.movies.map((movie) => movie.id));
   const cinemas = new Set(result.cinemas.map((cinema) => cinema.id));
   if (result.cinemas.some((cinema) => cinema.cadena !== result.cadena)) {
      throw new Error("Cinema outside the source ownership boundary");
   }
   for (const showtime of result.showtimes) {
      if (!movies.has(showtime.movieId) || !cinemas.has(showtime.cinemaId)) {
         throw new Error("Orphan showtime: missing movie or cinema");
      }
   }
   if (!result.showtimes.length) {
      throw new Error("No verified showtimes; refusing to replace the last valid schedule");
   }
   return result;
}