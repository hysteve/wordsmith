/**
 * Check where a site ranks for a set of phrases.
 *
 * The measuring and the recording live in core's measure service, which the
 * keyword cloud's CLI also calls — one path, so the two cannot disagree about
 * what was observed.
 */
import { measureRankings } from "@wordsmith/core/services/measure.js";

export async function rankingsJob(payload, ctx) {
  const { phrases = [], target, delayMs, pages = 1 } = payload;
  if (!phrases.length)
    throw new Error("rankings job needs at least one phrase");

  const rows = await measureRankings(phrases, {
    target,
    pages,
    delayMs,
    runId: ctx.runId,
    onProgress: (done, total, phrase) =>
      ctx.progress(`Checking ${done}/${total}: "${phrase}"`),
  });

  return {
    checked: rows.length,
    blocked: rows.filter((r) => r.status === "blocked").length,
    results: rows.map((r) => ({
      phrase: r.phrase,
      status: r.status,
      position: r.position,
    })),
  };
}
