import { StructuredScraper } from "./shared/structured-scraper";

export class StudioScraper extends StructuredScraper {
  readonly id = "studio";
  readonly name = "Studio Cinemas";
  readonly url = "https://www.studiocinemascr.com/";
  readonly movieLinkSelector = 'a[href*="pelicula"], a[href*="movie"]';
}