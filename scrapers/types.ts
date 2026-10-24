import type { BrowserContext, Page } from "playwright";
import type { ScrapeResult } from "../src/domain/models";

export interface ScraperContext {
  browser: BrowserContext;
  navigate(page: Page, url: string): Promise<void>;
}

export interface CinemaScraper {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly maturity: "dom-verified" | "experimental";
  scrape(context: ScraperContext): Promise<ScrapeResult>;
}