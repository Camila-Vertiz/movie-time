import { StructuredScraper } from "./shared/structured-scraper";

export class CinemarkScraper extends StructuredScraper {
  readonly id = "cinemark";
  readonly name = "Cinemark Costa Rica";
  readonly url = "https://www.cinemarkca.com/costa-rica/cine?tag=773";
  readonly movieLinkSelector = 'a[href*="pelicula"], a[href*="movie"]';
}