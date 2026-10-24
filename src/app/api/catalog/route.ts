import { NextRequest, NextResponse } from "next/server";
import { filterShowtimes, getCatalog, rankMovies } from "@/application/catalog-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const filtersSchema = z.object({
  q: z.string().max(160).optional(), cinema: z.string().max(160).optional(),
  movie: z.string().max(160).optional(), date: z.string().date().optional(),
});

export async function GET(request: NextRequest) {
  const filters = filtersSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!filters.success) return NextResponse.json({ error: "Filtros inválidos" }, { status: 400 });
  try {
    const catalog = await getCatalog();
    const showtimes = filterShowtimes(catalog, filters.data);
    return NextResponse.json({ ...catalog, showtimes, ranking: rankMovies(catalog.movies, showtimes) }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("Catalog read failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "No se pudo consultar la cartelera. Inténtalo más tarde." }, { status: 503 });
  }
}