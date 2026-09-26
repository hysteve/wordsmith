/**
 * Check where a site ranks for a set of phrases.
 *
 * Deliberately slow: Google throttles consecutive searches, and a sweep that
 * runs flat out comes back `blocked` for everything. The delay is the feature.
 */
import { checkPhraseRanking } from "@wordsmith/core/services/cloud.js";
import { sites, observations } from "@wordsmith/core/store/index.ts";

const DEFAULT_DELAY_MS = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function rankingsJob(payload, ctx) {
  const {
    phrases = [],
    target,
    delayMs = DEFAULT_DELAY_MS,
    pages = 1,
  } = payload;
  if (!phrases.length)
    throw new Error("rankings job needs at least one phrase");

  const site = target ? await sites.siteFor(target) : null;
  const results = [];

  for (const [i, phrase] of phrases.entries()) {
    ctx.progress(`Checking ${i + 1}/${phrases.length}: "${phrase}"`);

    const check = await checkPhraseRanking(phrase, { target, pages });

    await observations.recordRanking({
      runId: ctx.runId,
      siteId: site?.id ?? null,
      phrase,
      status: check.status,
      position: check.position ?? null,
      reason: check.reason ?? null,
      totalResults: check.totalResults ?? null,
    });

    // Keep the SERP too: it answers "who else is ranking for this" later,
    // without re-running the search.
    if (check.results?.length) {
      await observations.recordSerp(
        ctx.runId,
        phrase,
        check.results.map((r) => ({
          rank: r.rank,
          url: r.url,
          title: r.title,
        })),
      );
    }

    results.push({
      phrase,
      status: check.status,
      position: check.position ?? null,
    });

    // Jitter, so the pattern does not look like a script.
    if (i < phrases.length - 1) {
      await sleep(delayMs + Math.floor(Math.random() * 2000));
    }
  }

  const blocked = results.filter((r) => r.status === "blocked").length;
  return { checked: results.length, blocked, results };
}
