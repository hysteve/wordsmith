/**
 * Live Google completions for a seed, kept as candidates.
 *
 * Completion order is a popularity **proxy**, not a search volume. The store
 * writes these with quality "proxy" so nothing downstream can present them as
 * a measurement.
 */
import { extractQueryCompletions } from "@wordsmith/core/scrapers/googled.js";
import { observations } from "@wordsmith/core/store/index.ts";

export async function proposeJob(payload, ctx) {
  const { seed, cascade = false, delay = 1500, limit = 10 } = payload;
  if (!seed) throw new Error("propose job needs a seed phrase");

  ctx.progress(`Asking Google to complete "${seed}"`);
  const groups = await extractQueryCompletions(seed, { cascade, delay, limit });

  const stored = await observations.recordCompletions(ctx.runId, seed, groups);
  return { seed, groups: groups.length, completions: stored };
}
