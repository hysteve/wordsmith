/**
 * Job handlers.
 *
 * A handler is `async (payload, ctx) => result`. `ctx.progress(text)` writes a
 * line the UI can show while the job runs; `ctx.runId` is the provenance row
 * every measurement it records must point at.
 *
 * Each handler wraps a core service. None of them contain measurement logic —
 * if a handler starts scraping, the boundary has moved.
 */
import { rankingsJob } from "./rankings.js";
import { coverageJob } from "./coverage.js";
import { auditJob } from "./audit.js";
import { proposeJob } from "./propose.js";
import { crawlJob } from "./crawl.js";
import { keywordsJob } from "./keywords.js";

export const handlers = {
  rankings: rankingsJob,
  coverage: coverageJob,
  audit: auditJob,
  propose: proposeJob,
  crawl: crawlJob,
  keywords: keywordsJob,
};

export const JOB_KINDS = Object.keys(handlers);
