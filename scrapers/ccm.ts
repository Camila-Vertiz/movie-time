import { StructuredScraper } from "./shared/structured-scraper";

export class CCMScraper extends StructuredScraper {
  readonly id = "ccm";
  readonly name = "CCM Cinemas";
  readonly url = "https://www.ccmcinemas.com/";
  readonly movieLinkSelector = 'a[href*="Peliculas?codPelicula="]';
}