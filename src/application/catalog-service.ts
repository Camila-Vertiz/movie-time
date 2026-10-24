import type { Catalog, Movie, Showtime } from "../domain/models";
import { getDemoCatalog } from "../infrastructure/demo-catalog";
import { SupabaseCatalogRepository } from "../infrastructure/supabase-catalog-repository";

export async function getCatalog(): Promise<Catalog> {
  if (process.env.DEMO_MODE === "true") return getDemoCatalog();
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!configured && process.env.DEMO_MODE !== "false") return getDemoCatalog();
  return new SupabaseCatalogRepository().getCatalog();
}

export interface CatalogFilters { q?: string; cinema?: string; movie?: string; date?: string }

export function filterShowtimes(catalog: Catalog, filters: CatalogFilters): Showtime[] {
  const query = filters.q?.trim().toLocaleLowerCase("es");
  const movieIds = new Set(catalog.movies.filter((movie) => !query || movie.titulo.toLocaleLowerCase("es").includes(query)).map((movie) => movie.id));
  return catalog.showtimes.filter((showtime) => movieIds.has(showtime.movieId)
    && (!filters.cinema || showtime.cinemaId === filters.cinema)
    && (!filters.movie || showtime.movieId === filters.movie)
    && (!filters.date || showtime.fecha === filters.date));
}

export function rankMovies(movies: Movie[], showtimes: Showtime[]) {
  const counts = new Map<string, number>();
  for (const showtime of showtimes) counts.set(showtime.movieId, (counts.get(showtime.movieId) ?? 0) + 1);
  return movies.map((movie) => ({ ...movie, funciones: counts.get(movie.id) ?? 0 }))
    .filter((movie) => movie.funciones > 0)
    .sort((first, second) => second.funciones - first.funciones || first.titulo.localeCompare(second.titulo));
}