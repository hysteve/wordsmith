/**
 * Is the phrase actually present on the page?
 *
 * Pairs with rankings: coverage proves presence, ranking proves position, and
 * the gap between them is where the work is. Shares core's measure service
 * with the keyword cloud's CLI.
 */
import { measureCoverage } from "@wordsmith/core/services/measure.js";

export async function coverageJob(payload, ctx) {
  const { url, phrases = [] } = payload;
  if (!url) throw new Error("coverage job needs a url");
  if (!phrases.length)
    throw new Error("coverage job needs at least one phrase");

  const rows = await measureCoverage(url, phrases, {
    runId: ctx.runId,
    onProgress: (text) => ctx.progress(text),
  });

  return {
    url,
    checked: rows.length,
    present: rows.filter((r) => r.present).length,
    results: rows.map((r) => ({
      phrase: r.phrase,
      present: r.present,
      occurrences: r.occurrences,
    })),
  };
}
