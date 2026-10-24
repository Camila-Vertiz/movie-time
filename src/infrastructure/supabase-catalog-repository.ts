import { createClient } from "@supabase/supabase-js";
import type { CatalogRepository } from "../domain/catalog-repository";
import { cinemaSchema, movieSchema, showtimeSchema, type Catalog, type SourceStatus } from "../domain/models";
import { localDate } from "../lib/dates";

export class SupabaseCatalogRepository implements CatalogRepository {
  async getCatalog(): Promise<Catalog> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase configuration is missing");
    const db = createClient(url, key, { auth: { persistSession: false } });
    const [movies, cinemas, sources] = await Promise.all([
      db.from("movies").select("*"),
      db.from("cinemas").select("*"),
      db.from("source_status").select("*"),
    ]);
    for (const response of [movies, cinemas, sources]) {
      if (response.error) throw new Error(`Catalog unavailable: ${response.error.code}`);
    }
    const showtimes = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await db.from("showtimes").select("*")
        .gte("fecha", localDate()).order("id").range(offset, offset + 999);
      if (page.error) throw new Error(`Showtimes unavailable: ${page.error.code}`);
      showtimes.push(...(page.data ?? []));
      if (!page.data || page.data.length < 1000) break;
    }
    const parsedMovies = (movies.data ?? []).map((movie) => movieSchema.parse(movie));
    const parsedShowtimes = showtimes.map((showtime) => showtimeSchema.parse(showtime));
    const activeMovies = new Set(parsedShowtimes.map((showtime) => showtime.movieId));
    const statuses = (sources.data ?? []) as SourceStatus[];
    const successes = statuses.flatMap((source) => source.ultimoExito ? [source.ultimoExito] : []).sort();
    return {
      movies: parsedMovies.filter((movie) => activeMovies.has(movie.id) || movie.proximoEstreno),
      cinemas: (cinemas.data ?? []).map((cinema) => cinemaSchema.parse(cinema)),
      showtimes: parsedShowtimes, sources: statuses, mode: "live",
      updatedAt: successes.at(-1) ?? null,
    };
  }
}