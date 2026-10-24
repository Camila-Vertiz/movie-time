import { StructuredScraper } from "./shared/structured-scraper";

export class NovaScraper extends StructuredScraper {
  readonly id = "nova";
  readonly name = "Nova Cinemas";
  readonly url = "https://www.novacinemas.cr/";
  readonly movieLinkSelector = 'a[href*="/movies/"]';
}