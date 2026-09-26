/** Walk a site's links and record the pages found. */
import { crawlSite } from "@wordsmith/core/scrapers/sitemap.js";
import { sites, observations } from "@wordsmith/core/store/index.ts";

export async function crawlJob(payload, ctx) {
  const { url, maxPages = 25, maxDepth = 3, includeExternal = false } = payload;
  if (!url) throw new Error("crawl job needs a url");

  const site = await sites.siteFor(url);

  const result = await crawlSite(url, {
    maxPages,
    maxDepth,
    includeExternal,
    onProgress: (event) => {
      if (event?.url) ctx.progress(`Crawled ${event.url}`);
    },
  });

  const found = (result.crawledPages || []).map((pageUrl) => ({
    url: pageUrl,
  }));
  await observations.recordPages(ctx.runId, site.id, found);

  return {
    url,
    crawled: result.totalCrawled ?? found.length,
    links: result.totalLinks ?? null,
  };
}
