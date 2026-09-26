/**
 * Is the phrase actually present on the page?
 *
 * Pairs with rankings: coverage proves presence, ranking proves position, and
 * the difference between them is where the work is.
 *
 * The match is against the page's real text. Answering this from the n-gram
 * index that `keywords` builds looks equivalent and is not — that index comes
 * from a stopword-filtered word list, so its pairs are not substrings of the
 * page and any multi-word phrase containing a stopword reads as absent.
 */
import { pageText } from "@wordsmith/core/scrapers/keywords.js";
import {
  normalizePhrase,
  countOccurrences,
} from "@wordsmith/core/services/cloud-core.js";
import { sites, observations } from "@wordsmith/core/store/index.ts";

export async function coverageJob(payload, ctx) {
  const { url, phrases = [] } = payload;
  if (!url) throw new Error("coverage job needs a url");
  if (!phrases.length)
    throw new Error("coverage job needs at least one phrase");

  ctx.progress(`Reading ${url}`);
  const site = await sites.siteFor(url);

  // One fetch for every phrase; the page does not change between them.
  const text = await pageText(url);

  const results = [];
  for (const phrase of phrases) {
    const norm = normalizePhrase(phrase);
    const occurrences = countOccurrences(text, norm);

    await observations.recordCoverage({
      runId: ctx.runId,
      siteId: site.id,
      phrase: norm,
      url,
      present: occurrences > 0,
      occurrences,
    });
    results.push({ phrase: norm, present: occurrences > 0, occurrences });
  }

  return {
    url,
    checked: results.length,
    present: results.filter((r) => r.present).length,
    results,
  };
}
