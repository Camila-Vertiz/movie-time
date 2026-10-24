import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { getEnabledScrapers } from "../scrapers/registry";
import { createScraperBrowser } from "../scrapers/shared/browser";
import { validateScrapeResult } from "../src/domain/models";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const selected = getEnabledScrapers();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dryRun && (!url || !key)) throw new Error("Missing Supabase URL or service-role key. Use --dry-run to validate without writing.");
  const db = !dryRun && url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  const browser = await createScraperBrowser();
  const report: { cadena: string; estado: string; mensaje: string; movies?: number; showtimes?: number }[] = [];
  try {
    for (const scraper of selected) {
      console.log(`[${scraper.id}] ${scraper.maturity}${dryRun ? " (dry run)" : ""}`);
      try {
        const result = validateScrapeResult(await scraper.scrape(browser.context));
        if (db) {
          const { error } = await db.rpc("sync_cinema_snapshot", { p_chain: scraper.id, p_payload: result });
          if (error) throw new Error(`Atomic sync failed: ${error.message}`);
        }
        report.push({ cadena: scraper.id, estado: "ok", mensaje: dryRun ? "Validated; no database writes" : "Saved atomically", movies: result.movies.length, showtimes: result.showtimes.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown scraper failure";
        console.error(`[${scraper.id}] ${message}`);
        report.push({ cadena: scraper.id, estado: "error", mensaje: message });
        if (db) {
          const { error: statusError } = await db.from("source_status").update({ estado: "error", ultimaEjecucion: new Date().toISOString(), mensaje: "La fuente no pudo sincronizarse; revisar el informe de Actions." }).eq("cadena", scraper.id);
          if (statusError) console.error(`[${scraper.id}] Status update failed: ${statusError.code}`);
        }
      }
    }
  } finally {
    await browser.close();
    await writeFile("scrape-report.json", JSON.stringify({ timestamp: new Date().toISOString(), dryRun, results: report }, null, 2));
  }
  console.table(report);
  if (report.some((entry) => entry.estado === "error")) process.exitCode = 1;
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Scraping failed"); process.exitCode = 1; });