/**
 * Run one or more audits against a URL and record them.
 *
 * Audits used to land as a JSON blob and a JPEG under audit-results/, which
 * made "did this get better" unanswerable. The full payload is still kept
 * whole in `audit_runs.data` — nothing is lost — but the score and the
 * individual failures become rows, so they can be trended and counted.
 */
import path from "node:path";
import { outputDir, ensureDir } from "@wordsmith/core/paths.ts";
import { sites, observations } from "@wordsmith/core/store/index.ts";

import { runPerformanceAudit } from "@wordsmith/core/audits/performance.js";
import { runSEOAudit } from "@wordsmith/core/audits/seo.js";
import { runAccessibilityAudit } from "@wordsmith/core/audits/accessibility.js";
import { runUXAudit } from "@wordsmith/core/audits/ux.js";
import { runContentAudit } from "@wordsmith/core/audits/content.js";
import { runSecurityAudit } from "@wordsmith/core/audits/security.js";
import { runAnalyticsAudit } from "@wordsmith/core/audits/analytics.js";
import { runBusinessAudit } from "@wordsmith/core/audits/business.js";
import { runReputationAudit } from "@wordsmith/core/audits/reputation.js";

export const AUDITS = {
  performance: runPerformanceAudit,
  seo: runSEOAudit,
  accessibility: runAccessibilityAudit,
  ux: runUXAudit,
  content: runContentAudit,
  security: runSecurityAudit,
  analytics: runAnalyticsAudit,
  business: runBusinessAudit,
  reputation: runReputationAudit,
};

export function normalizeUrl(url) {
  if (!/^https?:\/\//i.test(url)) return `https://${url.replace(/^www\./, "")}`;
  return url.replace(/^http:\/\//i, "https://");
}

/**
 * Lighthouse scores are 0..1. Bucket a failure by how badly it scored, so the
 * UI can sort by severity without re-deriving the rule.
 */
function severityOf(score) {
  if (score === 0) return "p0";
  if (score < 0.5) return "p1";
  if (score < 0.9) return "p2";
  return "p3";
}

export async function auditJob(payload, ctx) {
  const { url, audits = Object.keys(AUDITS), skipLM = false } = payload;
  if (!url) throw new Error("audit job needs a url");

  const target = normalizeUrl(url);
  const site = await sites.siteFor(target);
  const dir = ensureDir(path.join(outputDir(), "audits"));

  const summary = {};
  for (const [i, type] of audits.entries()) {
    const run = AUDITS[type];
    if (!run) {
      summary[type] = { error: `Unknown audit type: ${type}` };
      continue;
    }

    ctx.progress(`Running ${type} audit (${i + 1}/${audits.length})`);

    try {
      const result = await run(target, { outputDir: dir, skipLM });

      // An audit that reports an error is recorded as having run and failed,
      // rather than silently leaving a gap in the history.
      if (result?.error) {
        summary[type] = { error: result.error };
        await observations.recordAudit({
          runId: ctx.runId,
          siteId: site.id,
          url: target,
          auditType: type,
          score: null,
          data: result,
        });
        continue;
      }

      const findings = (result.recommendations || []).map((r) => ({
        severity: severityOf(r.score),
        code: r.id,
        message: r.title,
        detail: {
          score: r.score,
          displayValue: r.displayValue,
          weight: r.weight,
        },
      }));

      await observations.recordAudit({
        runId: ctx.runId,
        siteId: site.id,
        url: target,
        auditType: type,
        score: typeof result.score === "number" ? result.score : null,
        data: result,
        screenshotPath: result.screenshots?.[0] ?? null,
        findings,
      });

      summary[type] = {
        score: result.score ?? null,
        findings: findings.length,
      };
    } catch (error) {
      summary[type] = { error: error.message };
      await observations.recordAudit({
        runId: ctx.runId,
        siteId: site.id,
        url: target,
        auditType: type,
        score: null,
        data: { error: error.message },
      });
    }
  }

  return { url: target, audits: summary };
}
