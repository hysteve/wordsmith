/**
 * Helpers for reading a Lighthouse report.
 *
 * Lighthouse scores an audit `null` when it did not apply to the page (manual,
 * informative, or notApplicable audits). `null < 1` is `true` in JS, so a naive
 * `score < 1` filter reports every inapplicable audit as a failure — which is
 * how a 19-word page ends up with 67 "recommendations".
 */

const FAILING_MODES = new Set(["numeric", "binary"]);

/**
 * Real failures for a category, worst first.
 * Returns the audit id alongside the title so a caller can look up details.
 */
export function collectFailures(report, category) {
  const auditRefs = report?.categories?.[category]?.auditRefs || [];
  return auditRefs
    .map((ref) => ({ ref, audit: report.audits?.[ref.id] }))
    .filter(({ audit }) => {
      if (!audit) return false;
      // Informative/manual/notApplicable audits carry a null score.
      if (audit.score === null || audit.score === undefined) return false;
      if (audit.scoreDisplayMode && !FAILING_MODES.has(audit.scoreDisplayMode))
        return false;
      return audit.score < 1;
    })
    .map(({ ref, audit }) => ({
      id: ref.id,
      title: audit.title,
      score: audit.score,
      displayValue: audit.displayValue,
      weight: ref.weight,
    }))
    .sort((a, b) => a.score - b.score || (b.weight || 0) - (a.weight || 0));
}

/**
 * Audits that Lighthouse skipped, so a report can say "not checked" instead of
 * silently implying "passed".
 */
export function collectNotApplicable(report, category) {
  const auditRefs = report?.categories?.[category]?.auditRefs || [];
  return auditRefs
    .filter((ref) => {
      const audit = report.audits?.[ref.id];
      return audit && (audit.score === null || audit.score === undefined);
    })
    .map((ref) => ref.id);
}

/** Raw audit entry, or null when absent. */
export function getAudit(report, id) {
  return report?.audits?.[id] || null;
}

/**
 * Read a category score, refusing to invent one.
 *
 * Lighthouse reports a failed run (tab crash, navigation error, timeout) as a
 * report with `runtimeError` set and `score: null`. `null * 100` is `0`, so a
 * naive read turns "we could not measure this page" into a confident score of
 * zero — the single most misleading number this suite can emit.
 *
 * Returns `{ score }` on success or `{ error }` when the run is unusable.
 */
export function readCategoryScore(report, category) {
  if (!report || !report.categories || !report.categories[category]) {
    return { error: `Lighthouse report missing ${category} data` };
  }
  if (report.runtimeError) {
    return {
      error: `Lighthouse run failed: ${report.runtimeError.code} — ${report.runtimeError.message}`,
    };
  }
  const raw = report.categories[category].score;
  if (raw === null || raw === undefined) {
    return {
      error: `Lighthouse returned no ${category} score (run did not complete)`,
    };
  }
  return { score: raw * 100, warnings: report.runWarnings || [] };
}
