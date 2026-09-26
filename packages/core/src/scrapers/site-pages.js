/**
 * Find a site's pages.
 *
 * Prefers the sitemap, for three reasons: it is what the site says its pages
 * are, it costs one HTTP request instead of a browser per page, and it does
 * not depend on every page being reachable by a link from the homepage.
 * Falls back to the link crawler when there is no sitemap.
 *
 * robots.txt is consulted for the sitemap location before guessing, because a
 * site is allowed to put it anywhere.
 */
import axios from "axios";
import { parseStringPromise } from "xml2js";
import { crawlSite } from "./sitemap.js";

const UA = "Mozilla/5.0 (compatible; wordsmith/1.0; +keyword research)";
const TIMEOUT = 15000;

function origin(url) {
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return new URL(withScheme).origin;
}

async function fetchText(url) {
  const { data } = await axios.get(url, {
    timeout: TIMEOUT,
    headers: { "User-Agent": UA },
    responseType: "text",
    // A 404 for a sitemap is an answer, not an exception.
    validateStatus: (s) => s >= 200 && s < 500,
    maxRedirects: 5,
  });
  return typeof data === "string" ? data : String(data ?? "");
}

/** Sitemap locations declared in robots.txt. */
async function sitemapsFromRobots(base) {
  try {
    const text = await fetchText(`${base}/robots.txt`);
    return [...text.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);
  } catch {
    return [];
  }
}

/**
 * Read one sitemap. A sitemap index points at more sitemaps, so this recurses
 * — with a depth limit, because an index that points at itself is a real thing
 * that happens.
 */
async function readSitemap(url, seen = new Set(), depth = 0) {
  if (depth > 3 || seen.has(url)) return [];
  seen.add(url);

  let xml;
  try {
    xml = await fetchText(url);
  } catch {
    return [];
  }
  if (!xml.trim().startsWith("<")) return [];

  let parsed;
  try {
    parsed = await parseStringPromise(xml);
  } catch {
    return [];
  }

  if (parsed.sitemapindex?.sitemap) {
    const children = parsed.sitemapindex.sitemap
      .map((s) => s.loc?.[0])
      .filter(Boolean);
    const nested = await Promise.all(
      children.map((child) => readSitemap(child, seen, depth + 1)),
    );
    return nested.flat();
  }

  if (parsed.urlset?.url) {
    return parsed.urlset.url
      .map((entry) => ({
        url: entry.loc?.[0],
        lastmod: entry.lastmod?.[0] ?? null,
      }))
      .filter((e) => e.url);
  }

  return [];
}

/**
 * @param {string} site a URL or bare hostname
 * @returns {Promise<{pages: Array<{url: string, lastmod: string|null}>,
 *   source: "sitemap"|"crawl", sitemap: string|null}>}
 */
export async function discoverPages(site, options = {}) {
  const { limit = 100, crawlFallback = true } = options;
  const base = origin(site);

  const candidates = [
    ...(await sitemapsFromRobots(base)),
    `${base}/sitemap.xml`,
    `${base}/sitemap_index.xml`,
  ];

  for (const candidate of [...new Set(candidates)]) {
    const pages = await readSitemap(candidate);
    if (pages.length) {
      // Same-origin only: a sitemap can legitimately list other hosts, and
      // proposing keywords from someone else's site is not what was asked for.
      const sameOrigin = pages.filter((p) => {
        try {
          return new URL(p.url).origin === base;
        } catch {
          return false;
        }
      });
      if (sameOrigin.length) {
        return {
          pages: sameOrigin.slice(0, limit),
          source: "sitemap",
          sitemap: candidate,
        };
      }
    }
  }

  if (!crawlFallback) return { pages: [], source: "sitemap", sitemap: null };

  const crawled = await crawlSite(base, {
    maxPages: Math.min(limit, 50),
    maxDepth: options.maxDepth ?? 3,
  });
  return {
    pages: (crawled.crawledPages || []).slice(0, limit).map((url) => ({
      url,
      lastmod: null,
    })),
    source: "crawl",
    sitemap: null,
  };
}
