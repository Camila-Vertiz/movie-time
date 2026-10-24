import { StructuredScraper } from "./shared/structured-scraper";

export class CinepolisScraper extends StructuredScraper {
  readonly id = "cinepolis";
  readonly name = "Cinépolis Costa Rica";
  readonly url = "https://cinepolis.co.cr/";
  readonly movieLinkSelector = 'a[href*="/movie/"]';
}