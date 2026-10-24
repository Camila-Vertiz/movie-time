import { chromium, type BrowserContext, type Page } from "playwright";
import robotsParser from "robots-parser";
import type { ScraperContext } from "../types";

export async function createScraperBrowser() {
  const userAgent = process.env.SCRAPER_USER_AGENT;
  if (!userAgent || /example\.com|your-project/.test(userAgent)) throw new Error("Configure SCRAPER_USER_AGENT with your real project URL and contact");
  const browser = await chromium.launch({ headless: true, channel: process.env.SCRAPER_BROWSER_CHANNEL || undefined });
  const context = await browser.newContext({ userAgent, locale: "es-CR", timezoneId: "America/Costa_Rica" });
  context.setDefaultTimeout(20_000);
  await context.route("**/*", async (route) => {
    if (["image", "font", "media"].includes(route.request().resourceType())) await route.abort();
    else await route.continue();
  });
  const navigate = createNavigator(context, userAgent);
  return { context: { browser: context, navigate } satisfies ScraperContext, close: () => browser.close() };
}

function createNavigator(context: BrowserContext, userAgent: string) {
  const policies = new Map<string, ReturnType<typeof robotsParser>>();
  const lastVisits = new Map<string, number>();
  return async function navigate(page: Page, value: string) {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error("Only HTTPS sources are accepted");
    if (!policies.has(url.origin)) {
      const robotsUrl = `${url.origin}/robots.txt`;
      const policyPage = await context.newPage();
      try {
        const response = await policyPage.goto(robotsUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
        if (!response || (!response.ok() && response.status() !== 404)) throw new Error(`robots.txt unavailable (${response?.status()}); refusing to crawl`);
        if (new URL(policyPage.url()).origin !== url.origin) throw new Error("robots.txt redirected to a different origin");
        policies.set(url.origin, robotsParser(robotsUrl, response.status() === 404 ? "" : await response.text()));
      } finally { await policyPage.close(); }
    }
    const policy = policies.get(url.origin)!;
    if (policy.isAllowed(url.href, userAgent) === false) throw new Error(`robots.txt disallows ${url.pathname}`);
    const delay = Math.max(1500, (policy.getCrawlDelay(userAgent) ?? 0) * 1000);
    const remaining = delay - (Date.now() - (lastVisits.get(url.origin) ?? 0));
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    lastVisits.set(url.origin, Date.now());
    const response = await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 45_000 });
    if (!response || !response.ok()) throw new Error(`Source returned HTTP ${response?.status() ?? "no response"}`);
    if (new URL(page.url()).origin !== url.origin) throw new Error("Source redirected to a different origin; review the adapter");
    if (/captcha|access denied|just a moment|sitio web se encuentra en mantenimiento/i.test(await page.locator("body").innerText())) {
      throw new Error("Source blocked or under maintenance; no bypass attempted");
    }
  };
}