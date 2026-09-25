import createBrowser from "browserless";
import { onExit } from "signal-exit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { runLM, lmAvailable } from "./lm-interface.js";
import { gotoOptions } from "./goto-options.js";
import {
  placesApiAvailable,
  getGoogleReviews,
  getUsage,
} from "../lib/places-api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const browser = createBrowser({ timeout: 120000 });
onExit(async () => await browser.close());

/**
 * Yelp is still unimplemented. It previously returned `[]`, which is
 * indistinguishable from "this business has no reviews" — a false negative a
 * report would present as fact — so it returns an explicit status instead.
 *
 * Yelp's Places API has no free tier: Base $229/mo (no review excerpts),
 * Enhanced $299/mo (3 excerpts), Premium $643/mo (7 excerpts). Its terms also
 * cap caching at 24 hours and forbid blending Yelp ratings with other sources.
 */
const YELP_NOT_IMPLEMENTED = {
  status: "not_implemented",
  reason:
    "Yelp Places API requires a paid plan (from $229/mo); no data was gathered.",
  reviews: [],
};

/**
 * Build the most specific text query available for place resolution. Name
 * alone is ambiguous for chains, so prefer name + street address, then
 * name + phone, then name + hostname.
 */
function buildPlaceQuery(identity, url) {
  const name = identity?.name;
  if (!name) return null;
  if (identity.address) return `${name}, ${identity.address}`;
  if (identity.phone) return `${name} ${identity.phone}`;
  try {
    return `${name} ${new URL(url).hostname.replace(/^www\./, "")}`;
  } catch {
    return name;
  }
}

/**
 * Google ratings and reviews via the Places API.
 *
 * Off by default: the Place Details call that carries review data bills at
 * $25 per 1,000 requests with only 1,000 free events a month, so an audit run
 * must opt in explicitly rather than quietly spending money. Enable with
 * `options.googleReviews` (CLI: `--googleReviews`).
 *
 * Pass a known `options.placeId` to skip resolution — place IDs are the one
 * field the terms allow you to store indefinitely, and reusing a stored one
 * costs nothing.
 */
async function collectGoogleReviews(identity, url, options) {
  if (!options.googleReviews) {
    return {
      status: "disabled",
      reason:
        "Google Places lookup is opt-in because Place Details with reviews bills at $25/1000 requests. Enable with --googleReviews.",
      reviews: [],
    };
  }
  if (!placesApiAvailable()) {
    return {
      status: "no_api_key",
      reason: "GOOGLE_MAPS_API_KEY is not set.",
      reviews: [],
    };
  }
  const query = options.placeId ? null : buildPlaceQuery(identity, url);
  if (!options.placeId && !query) {
    return {
      status: "no_query",
      reason: "Could not determine a business name to resolve a place ID.",
      reviews: [],
    };
  }
  try {
    const result = await getGoogleReviews({
      placeId: options.placeId,
      query,
    });
    return { ...result, usage: getUsage() };
  } catch (e) {
    return { status: "error", reason: e.message, reviews: [] };
  }
}

export async function runReputationAudit(url, options = {}) {
  const outputDir =
    options.outputDir || path.join(process.cwd(), "audit-results");
  await fs.mkdir(outputDir, { recursive: true });
  const browserless = await browser.createContext();
  let reputation = {};
  try {
    const extractReputation = await browserless.evaluate(
      async (page) =>
        page.evaluate(() => {
          // JSON-LD is the authoritative source for business identity and
          // ratings when present — far better than guessing from the DOM.
          const nodes = [];
          for (const s of document.querySelectorAll(
            'script[type="application/ld+json"]',
          )) {
            try {
              const walk = (n) => {
                if (!n || typeof n !== "object") return;
                if (Array.isArray(n)) return n.forEach(walk);
                nodes.push(n);
                Object.values(n).forEach(walk);
              };
              walk(JSON.parse(s.textContent));
            } catch {
              /* malformed JSON-LD is common; skip it */
            }
          }
          const typeOf = (n) => [].concat(n["@type"] || []).map(String);
          const findByType = (re) =>
            nodes.find((n) => typeOf(n).some((t) => re.test(t)));

          const org = findByType(
            /Organization|LocalBusiness|Store|Restaurant|ProfessionalService/,
          );
          const ratingNode = nodes.find((n) => n.aggregateRating);
          const agg = ratingNode?.aggregateRating;
          const flat = (v) =>
            v == null ? null : typeof v === "object" ? null : String(v);

          const addr = org?.address;
          const formatAddress = (a) => {
            if (!a) return null;
            if (typeof a === "string") return a;
            return (
              [
                a.streetAddress,
                a.addressLocality,
                a.addressRegion,
                a.postalCode,
                a.addressCountry,
              ]
                .filter((p) => typeof p === "string" && p.trim())
                .join(", ") || null
            );
          };

          // sameAs in structured data plus real profile links in the DOM.
          const PROFILE_HOSTS = [
            ["facebook", /facebook\.com/i],
            ["instagram", /instagram\.com/i],
            ["twitter/x", /twitter\.com|(^|\.)x\.com/i],
            ["linkedin", /linkedin\.com/i],
            ["youtube", /youtube\.com|youtu\.be/i],
            ["tiktok", /tiktok\.com/i],
            ["pinterest", /pinterest\./i],
            ["yelp", /yelp\.com/i],
            [
              "google maps",
              /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|g\.page/i,
            ],
            ["bbb", /bbb\.org/i],
            ["trustpilot", /trustpilot\.com/i],
          ];
          const hrefs = [
            ...new Set(
              [
                ...Array.from(document.querySelectorAll("a[href]")).map(
                  (a) => a.href,
                ),
                ...[]
                  .concat(org?.sameAs || [])
                  .filter((s) => typeof s === "string"),
              ].filter(Boolean),
            ),
          ];
          const profiles = {};
          for (const [name, re] of PROFILE_HOSTS) {
            const found = hrefs.filter((h) => re.test(h));
            if (found.length) profiles[name] = [...new Set(found)].slice(0, 3);
          }

          return {
            identity: {
              // Prefer declared org name over an h1 guess.
              name:
                flat(org?.name) ||
                document.querySelector('meta[property="og:site_name"]')
                  ?.content ||
                document.querySelector("h1")?.innerText?.trim() ||
                document.title ||
                null,
              nameSource: org?.name
                ? "schema.org"
                : document.querySelector('meta[property="og:site_name"]')
                  ? "og:site_name"
                  : "heading/title",
              schemaTypes: [...new Set(nodes.flatMap(typeOf))],
              address: formatAddress(addr),
              phone: flat(org?.telephone) || null,
            },
            onPageRating: agg
              ? {
                  ratingValue: flat(agg.ratingValue),
                  reviewCount: flat(agg.reviewCount ?? agg.ratingCount),
                  bestRating: flat(agg.bestRating) || "5",
                  source: "schema.org/AggregateRating",
                }
              : null,
            onPageReviews: nodes.filter((n) => typeOf(n).includes("Review"))
              .length,
            profiles,
            profileCount: Object.keys(profiles).length,
          };
        }),
      gotoOptions(),
    );
    reputation = await extractReputation(url);
  } finally {
    await browserless.destroyContext();
  }
  // Off-site sources are declared unchecked rather than reported as empty.
  reputation.offSite = {
    google: await collectGoogleReviews(reputation.identity, url, options),
    yelp: YELP_NOT_IMPLEMENTED,
    // A linked profile is evidence the business has a presence there, even
    // though the ratings themselves were not collected.
    linkedProfilesFound: Object.keys(reputation.profiles || {}),
  };
  const screenshotPath = path.join(outputDir, "reputation-screenshot.jpg");
  const browserless2 = await browser.createContext();
  try {
    const screenshot = await browserless2.screenshot(url, {
      type: "jpeg",
      quality: 80,
    });
    await fs.writeFile(screenshotPath, screenshot);
  } finally {
    await browserless2.destroyContext();
  }
  let lmAnalysis = null;
  if (lmAvailable() && !options.skipLM) {
    lmAnalysis = await runLM(
      `Summarize the following reputation audit: ${JSON.stringify(reputation)}`,
    );
  }
  return {
    auditType: "reputation",
    reputation,
    screenshots: [screenshotPath],
    lmAnalysis,
  };
}
