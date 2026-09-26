/**
 * The schema.
 *
 * The shape follows from one observation: every tool in this repo answers a
 * question about a (target, phrase, moment) and the answer is only worth
 * keeping if you can ask it again later and compare. Results used to land as
 * loose JSON and PNGs under output/ and audit-results/, which meant "how did
 * this term move last month" was unanswerable. So measurements are rows, and
 * every row points at the run that produced it.
 *
 * Two rules carried over from the CLI's hard-won honesty discipline
 * (see KEYWORD_CLOUD.md) and made structural here:
 *
 *   1. `blocked` is never stored as `not_in_results`. Google returns an empty
 *      SERP for both throttling and genuine absence; conflating them invents
 *      a measurement that was never taken.
 *   2. Every observation carries a `quality`, so a chart can render a gap
 *      rather than a zero. A dashboard makes every number look authoritative;
 *      the qualifier has to travel with the value.
 */
import {
  sqliteTable,
  integer,
  text,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const now = sql`(datetime('now'))`;

/* ------------------------------------------------------------------- keys */

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull().unique(),
    /**
     * SHA-256 of the raw key. Deterministic on purpose: authentication has to
     * find a key by its value, which a salted hash cannot do. The key is 256
     * bits of randomness, so it needs no stretching.
     */
    keyHash: text("key_hash").notNull().unique(),
    /** -1 revoked, 0 awaiting confirmation, 1 active. */
    status: integer("status").notNull().default(0),
    role: text("role").notNull().default("free"),
    requestCount: integer("request_count").notNull().default(0),
    requestLimit: integer("request_limit").notNull().default(1000),
    periodStart: text("period_start").notNull().default(now),
    created: text("created").notNull().default(now),
    lastAccessed: text("last_accessed"),
  },
  (t) => [index("api_keys_key_hash").on(t.keyHash)],
);

/* ------------------------------------------------------------------ sites */

/** A site we measure. Everything time-series hangs off one of these. */
export const sites = sqliteTable("sites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Bare hostname, no scheme and no leading www, so it joins reliably. */
  host: text("host").notNull().unique(),
  label: text("label"),
  created: text("created").notNull().default(now),
});

/* ------------------------------------------------------------------- jobs */

/**
 * Work that cannot happen inside a request.
 *
 * An audit is minutes of browser time and a ranking sweep is deliberately
 * throttled, so the web UI enqueues and polls rather than blocking. SQLite is
 * a fine queue at this scale precisely because there is a single writer — the
 * worker owns the database file and claims rows atomically.
 */
export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Which handler runs this; see worker/src/jobs/handlers. */
    kind: text("kind").notNull(),
    /** Handler input, JSON. Opaque to the queue. */
    payload: text("payload", { mode: "json" }).notNull(),
    /** queued | running | done | failed | cancelled */
    status: text("status").notNull().default("queued"),
    /** Higher runs first. */
    priority: integer("priority").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(1),
    /** Not eligible before this time; how retries back off. */
    runAfter: text("run_after").notNull().default(now),
    /** Set when claimed, so a crashed worker's jobs can be spotted. */
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    /** Free-text progress for the UI to show while it runs. */
    progress: text("progress"),
    error: text("error"),
    result: text("result", { mode: "json" }),
    created: text("created").notNull().default(now),
  },
  (t) => [
    // The claim query: eligible work, best first.
    index("jobs_claim").on(t.status, t.priority, t.runAfter),
  ],
);

/* ------------------------------------------------------------------- runs */

/**
 * One tool invocation. Provenance for every measurement below, so any number
 * in the UI can be traced back to when it was taken and with what arguments.
 */
export const runs = sqliteTable(
  "runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** ranked | googled | keywords | coverage | audit | sitemap | ... */
    tool: text("tool").notNull(),
    /** The URL, phrase, or cloud name the run was about. */
    target: text("target"),
    siteId: integer("site_id").references(() => sites.id),
    /** The options the tool was called with, JSON. */
    params: text("params", { mode: "json" }),
    /** running | ok | error */
    status: text("status").notNull().default("running"),
    error: text("error"),
    /** Set when a run came from the queue rather than a CLI. */
    jobId: integer("job_id").references(() => jobs.id),
    startedAt: text("started_at").notNull().default(now),
    finishedAt: text("finished_at"),
  },
  (t) => [index("runs_tool_started").on(t.tool, t.startedAt)],
);

/* ----------------------------------------------------------- measurements */

/**
 * How `quality` is meant to be read. It rides with every observation so a
 * renderer never has to guess what a missing number means.
 *
 *   measured — we saw it and this is the value
 *   proxy    — a stand-in, not the thing itself (completion order is a
 *              popularity proxy, never search volume)
 *   blocked  — the check ran and was refused; render a gap, never a zero
 *   absent   — the check ran and the thing genuinely was not there
 */
export const QUALITY = ["measured", "proxy", "blocked", "absent"] as const;
export type Quality = (typeof QUALITY)[number];

/** Where a site ranks for a phrase, over time. The core time series. */
export const rankObservations = sqliteTable(
  "rank_observations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: integer("run_id")
      .notNull()
      .references(() => runs.id),
    siteId: integer("site_id").references(() => sites.id),
    phrase: text("phrase").notNull(),
    /** Null whenever quality is not "measured". */
    position: integer("position"),
    /** ranked | not_in_results | blocked | error — never collapsed. */
    status: text("status").notNull(),
    quality: text("quality").notNull(),
    /** Why, when the status is not a clean result. */
    reason: text("reason"),
    totalResults: integer("total_results"),
    observedAt: text("observed_at").notNull().default(now),
  },
  (t) => [index("rank_obs_phrase_time").on(t.phrase, t.observedAt)],
);

/** The full SERP behind a rank observation — who else is there. */
export const serpResults = sqliteTable(
  "serp_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: integer("run_id")
      .notNull()
      .references(() => runs.id),
    phrase: text("phrase").notNull(),
    rank: integer("rank").notNull(),
    url: text("url").notNull(),
    host: text("host"),
    title: text("title"),
  },
  (t) => [index("serp_run_rank").on(t.runId, t.rank)],
);

/** Whether a phrase is actually present on a page. Intent versus presence. */
export const coverageObservations = sqliteTable(
  "coverage_observations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: integer("run_id")
      .notNull()
      .references(() => runs.id),
    siteId: integer("site_id").references(() => sites.id),
    phrase: text("phrase").notNull(),
    url: text("url").notNull(),
    present: integer("present", { mode: "boolean" }).notNull(),
    occurrences: integer("occurrences").notNull().default(0),
    quality: text("quality").notNull().default("measured"),
    observedAt: text("observed_at").notNull().default(now),
  },
  (t) => [index("coverage_phrase_time").on(t.phrase, t.observedAt)],
);

/**
 * Google's live completions for a seed.
 *
 * `position` is the order Google offered them, which is a popularity **proxy**
 * and not a volume figure. Stored as quality "proxy" so nothing downstream can
 * quietly promote it to a measurement.
 */
export const completions = sqliteTable(
  "completions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: integer("run_id")
      .notNull()
      .references(() => runs.id),
    /** The cloud this exploration belongs to, so history can be scoped to it. */
    cloud: text("cloud"),
    seed: text("seed").notNull(),
    query: text("query").notNull(),
    phrase: text("phrase").notNull(),
    position: integer("position").notNull(),
    quality: text("quality").notNull().default("proxy"),
    observedAt: text("observed_at").notNull().default(now),
  },
  (t) => [
    index("completions_seed_time").on(t.seed, t.observedAt),
    index("completions_cloud").on(t.cloud, t.observedAt),
  ],
);

/** Word, pair and triplet counts for a page, so wording can be tracked. */
export const pageTerms = sqliteTable(
  "page_terms",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: integer("run_id")
      .notNull()
      .references(() => runs.id),
    siteId: integer("site_id").references(() => sites.id),
    url: text("url").notNull(),
    term: text("term").notNull(),
    /** 1 = word, 2 = pair, 3 = triplet. */
    n: integer("n").notNull(),
    count: integer("count").notNull(),
    observedAt: text("observed_at").notNull().default(now),
  },
  (t) => [index("page_terms_url_time").on(t.url, t.observedAt)],
);

/* ----------------------------------------------------------------- audits */

export const auditRuns = sqliteTable(
  "audit_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: integer("run_id")
      .notNull()
      .references(() => runs.id),
    siteId: integer("site_id").references(() => sites.id),
    url: text("url").notNull(),
    /** performance | seo | accessibility | ux | content | security | ... */
    auditType: text("audit_type").notNull(),
    /**
     * 0..100, matching Lighthouse's category scale, where the audit produces
     * one. Null where the audit does not score or the run failed — never 0,
     * which would read as "measured and terrible" rather than "not measured".
     * Individual findings use Lighthouse's raw 0..1 audit scores.
     */
    score: real("score"),
    /** The audit's own structured output, kept whole. */
    data: text("data", { mode: "json" }),
    screenshotPath: text("screenshot_path"),
    observedAt: text("observed_at").notNull().default(now),
  },
  (t) => [
    index("audit_runs_url_type_time").on(t.url, t.auditType, t.observedAt),
  ],
);

export const auditFindings = sqliteTable(
  "audit_findings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    auditRunId: integer("audit_run_id")
      .notNull()
      .references(() => auditRuns.id),
    /** p0 | p1 | p2 | p3 */
    severity: text("severity").notNull(),
    code: text("code"),
    message: text("message").notNull(),
    detail: text("detail", { mode: "json" }),
  },
  (t) => [index("audit_findings_run").on(t.auditRunId, t.severity)],
);

/* ------------------------------------------------------------- crawl/pages */

/** Pages discovered by the crawler, per run. */
export const pages = sqliteTable(
  "pages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: integer("run_id")
      .notNull()
      .references(() => runs.id),
    siteId: integer("site_id").references(() => sites.id),
    url: text("url").notNull(),
    depth: integer("depth"),
    title: text("title"),
    observedAt: text("observed_at").notNull().default(now),
  },
  (t) => [uniqueIndex("pages_run_url").on(t.runId, t.url)],
);
