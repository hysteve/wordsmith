/**
 * Top Google results for a query, or the sites linking back to a URL.
 *
 * The CLI used to carry its own copy of this — same selectors, same URL
 * builder, drifting independently. This is the only implementation; the CLI
 * and the HTTP route are both callers, and so is anything else later.
 */
import path from "path";
import { outputDir, ensureDir } from "../paths.ts";
import { browser } from "../adapters/browser.js";

const defaultGotoOptions = {
  device: "macbook pro 13",
  waitUntil: "auto",
  adblock: true,
};

/** `link:` finds backlinks; `-site:` keeps the target's own pages out. */
export function getGoogleSearchUrl(query, options = {}) {
  const queryParam = query ? escape(query.replace(/\s/g, "+")) : "";
  const link = options.linkbacks
    ? `link%3A${options.linkbacks}+-site%3A${options.linkbacks}`
    : "";
  if (!queryParam && !link) {
    throw new Error("There is no search query or site link query set");
  }
  const excludes = [].concat(options.exclude || []).map((s) => `-site%3A${s}`);
  return `https://google.com/search?q=${[link || queryParam].concat(excludes).join("+")}`;
}

/**
 * @returns {Promise<{results: Array<{url: string, title: string, rank: number}>,
 *   screenshot: string|null}>} the screenshot path is returned rather than
 *   printed, so a caller can display it, attach it, or ignore it.
 */
export async function extractQueryRankings(searchQuery, options = {}) {
  const { pages = 1, screenshot = false } = options;
  const mainUrl = getGoogleSearchUrl(searchQuery, options);

  let screenshotPath = null;
  const browserless = await browser.createContext();

  try {
    const scrape = await browserless.evaluate(async (page) => {
      await page.setViewport({ width: 1920 / 2, height: 1080 * 2 });

      if (screenshot && !screenshotPath) {
        screenshotPath = path.join(
          ensureDir(outputDir()),
          `ranked_${new Date().toISOString().replace(/[\W]+/g, "-")}.png`,
        );
        await page.screenshot({ path: screenshotPath, type: "png" });
      }

      return page.evaluate(() => {
        // Google wraps result links; the real destination is in ?url=.
        const getUrlAttribute = (href) => {
          const matches = href.match(/(?:url=)(https?.*?)(&|$)/);
          return matches && matches[1] ? matches[1] : null;
        };
        return Array.from(document.querySelectorAll("a[href][data-ved]"))
          .map((a) => ({
            url: getUrlAttribute(a.getAttribute("href")),
            title: a.querySelector("h3")?.textContent ?? null,
          }))
          .filter(({ url, title }) => Boolean(url) && Boolean(title));
      });
    }, defaultGotoOptions);

    const results = [];
    for (let remaining = pages; remaining > 0; remaining--) {
      const url = results.length
        ? `${mainUrl}&start=${results.length}`
        : mainUrl;
      const batch = await scrape(url);
      results.push(
        ...batch.map((r, i) => ({ ...r, rank: results.length + i + 1 })),
      );
    }

    return { results, screenshot: screenshotPath };
  } finally {
    await browserless.destroyContext();
  }
}
