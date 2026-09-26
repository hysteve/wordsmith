/**
 * Taking a measurement and recording it.
 *
 * There are two callers for every measurement — the keyword cloud's CLI
 * commands and the job handlers behind the HTTP API — and for a moment they
 * each wrote to a different place: the cloud appended to its JSON document
 * while the jobs inserted rows. Two stores for the same number is how they
 * start disagreeing, so both go through here.
 *
 * The division that remains is deliberate:
 *
 *   the cloud document  — intent and curation: which terms we track, their
 *                         status, their roles, their assignments
 *   the database        — observation: what was true at a moment, with the
 *                         run that produced it
 *
 * Nothing is written by both, so they cannot drift into conflict.
 */
import { pageText } from "../scrapers/keywords.js";
import { extractQueryRankings } from "../scrapers/ranked.js";
import { normalizePhrase, countOccurrences } from "./cloud-core.js";
import { sites, runs, observations } from "../store/index.ts";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Rank a single phrase, distinguishing "not ranking" from "we got blocked".
 *
 * Google throttles consecutive requests and `ranked` returns an empty array
 * either way. Recording that as position-not-found would be a silent, false
 * measurement, so an empty SERP is reported as `blocked` and only a populated
 * SERP that lacks the target counts as `not_in_results`.
 */
export async function checkPhraseRanking(phrase, options = {}) {
  const { target } = options;
  let results;
  try {
    ({ results } = await extractQueryRankings(phrase, {
      pages: options.pages ?? 1,
      exclude: [],
      screenshot: false,
    }));
  } catch (e) {
    return { phrase, status: "error", reason: e.message, results: [] };
  }

  if (!results || results.length === 0) {
    return {
      phrase,
      status: "blocked",
      reason:
        "Google returned an empty result set. This is usually throttling of consecutive requests, not an absence of results — increase --delay.",
      results: [],
    };
  }

  if (!target)
    return { phrase, status: "ranked", results, totalResults: results.length };

  const host = (u) => {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  };
  const targetHost = host(
    target.startsWith("http") ? target : `https://${target}`,
  );
  const hit = results.find((r) => host(r.url) === targetHost);

  return hit
    ? {
        phrase,
        status: "ranked",
        position: hit.rank,
        url: hit.url,
        title: hit.title,
        totalResults: results.length,
        results,
      }
    : {
        phrase,
        status: "not_in_results",
        totalResults: results.length,
        results,
      };
}

/**
 * Resolve the run and site a measurement belongs to.
 * A job passes its own runId; a CLI gets one created for it.
 */
async function context({ runId, tool, target, params }) {
  const site = target ? await sites.siteFor(target) : null;
  if (runId) return { runId, siteId: site?.id ?? null, ownRun: false };

  const run = await runs.startRun({
    tool,
    target: target ?? null,
    siteId: site?.id ?? null,
    params: params ?? null,
  });
  return { runId: run.id, siteId: site?.id ?? null, ownRun: true };
}

/**
 * Check where `target` ranks for each phrase, recording every check.
 *
 * Deliberately slow. Google throttles consecutive searches, and a sweep that
 * runs flat out comes back `blocked` for everything — the delay is the feature,
 * not an oversight.
 */
export async function measureRankings(phrases, options = {}) {
  const {
    target,
    pages = 1,
    delayMs = 5000,
    onProgress = () => {},
    runId,
  } = options;

  // Nothing to check is not a run; don't open a browser or leave a row behind.
  if (!phrases.length) return [];

  const ctx = await context({
    runId,
    tool: "rankings",
    target,
    params: { phrases, pages },
  });

  const rows = [];
  try {
    for (const [i, raw] of phrases.entries()) {
      const phrase = normalizePhrase(raw);
      if (i > 0) {
        // Jitter, so repeat runs do not form a perfectly regular pattern.
        await sleep(delayMs + Math.floor(Math.random() * 1000));
      }
      onProgress(i + 1, phrases.length, phrase);

      const check = await checkPhraseRanking(phrase, { target, pages });

      await observations.recordRanking({
        runId: ctx.runId,
        siteId: ctx.siteId,
        phrase,
        status: check.status,
        position: check.position ?? null,
        reason: check.reason ?? null,
        totalResults: check.totalResults ?? null,
      });

      // Keep the SERP: it answers "who else ranks for this" later without
      // spending another search on it.
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

      rows.push({
        phrase,
        status: check.status,
        position: check.position ?? null,
        url: check.url ?? null,
        title: check.title ?? null,
        totalResults: check.totalResults ?? 0,
        reason: check.reason ?? null,
        checkedAt: new Date().toISOString(),
      });
    }
    if (ctx.ownRun) await runs.finishRun(ctx.runId);
    return rows;
  } catch (error) {
    if (ctx.ownRun) await runs.failRun(ctx.runId, error);
    throw error;
  }
}

/**
 * Is each phrase actually present on the page?
 *
 * Matched against the page's real text. The n-gram index that `keywords`
 * builds looks like it would serve, and does not: it comes from a
 * stopword-filtered word list, so its pairs are not substrings of the page and
 * any multi-word phrase containing a stopword reads as absent.
 */
export async function measureCoverage(url, phrases, options = {}) {
  const { runId, onProgress = () => {} } = options;
  if (!url) throw new Error("A URL is required");
  // Fetching the page to check nothing against it is pure waste.
  if (!phrases.length) return [];

  const ctx = await context({
    runId,
    tool: "coverage",
    target: url,
    params: { phrases },
  });

  try {
    onProgress(`Reading ${url}`);
    // One fetch for every phrase; the page does not change between them.
    const text = await pageText(url);

    const rows = [];
    for (const raw of phrases) {
      const phrase = normalizePhrase(raw);
      const occurrences = countOccurrences(text, phrase);

      await observations.recordCoverage({
        runId: ctx.runId,
        siteId: ctx.siteId,
        phrase,
        url,
        present: occurrences > 0,
        occurrences,
      });

      rows.push({
        phrase,
        pageUrl: url,
        occurrences,
        present: occurrences > 0,
        checkedAt: new Date().toISOString(),
      });
    }

    if (ctx.ownRun) await runs.finishRun(ctx.runId);
    return rows;
  } catch (error) {
    if (ctx.ownRun) await runs.failRun(ctx.runId, error);
    throw error;
  }
}
