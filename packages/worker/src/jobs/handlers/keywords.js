/** Extract a page's word, pair and triplet counts and keep them. */
import { parseKeywords } from "@wordsmith/core/scrapers/keywords.js";
import { sites, observations } from "@wordsmith/core/store/index.ts";

export async function keywordsJob(payload, ctx) {
  const { url, minCount = 2 } = payload;
  if (!url) throw new Error("keywords job needs a url");

  ctx.progress(`Extracting keywords from ${url}`);
  const site = await sites.siteFor(url);
  const result = await parseKeywords(url, { minCount });

  const stored = await observations.recordPageTerms({
    runId: ctx.runId,
    siteId: site.id,
    url,
    words: result.words,
    pairs: result.pairs,
    triplets: result.triplets,
  });

  return {
    url,
    terms: stored,
    words: result.words.length,
    pairs: result.pairs.length,
    triplets: result.triplets.length,
  };
}
