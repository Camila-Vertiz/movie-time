import { StructuredScraper } from "./shared/structured-scraper";

export class SanPedroScraper extends StructuredScraper {
  readonly id = "sanpedro";
  readonly name = "Cinemas San Pedro";
  readonly url = "https://cinemasanpedro.com/home";
  readonly movieLinkSelector = 'a[href*="pelicula"], a[href*="movie"]';
}