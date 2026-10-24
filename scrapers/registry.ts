import type { CinemaScraper } from "./types";
import { CinepolisScraper } from "./cinepolis";
import { CinemarkScraper } from "./cinemark";
import { StudioScraper } from "./studio";
import { MagalyScraper } from "./magaly";
import { SanPedroScraper } from "./san-pedro";
import { NovaScraper } from "./nova";
import { CCMScraper } from "./ccm";
import { GarboScraper } from "./garbo";

export const scrapers: CinemaScraper[] = [new CinepolisScraper(), new CinemarkScraper(), new StudioScraper(), new MagalyScraper(), new SanPedroScraper(), new NovaScraper(), new CCMScraper(), new GarboScraper()];

export function getEnabledScrapers(input = process.env.SCRAPER_ENABLED_CHAINS ?? ""): CinemaScraper[] {
  const ids = new Set(input.split(",").map((value) => value.trim()).filter(Boolean));
  if (!ids.size) throw new Error("No sources enabled. Set SCRAPER_ENABLED_CHAINS after reviewing source terms.");
  for (const id of ids) if (!scrapers.some((scraper) => scraper.id === id)) throw new Error(`Unknown source: ${id}`);
  return scrapers.filter((scraper) => ids.has(scraper.id));
}