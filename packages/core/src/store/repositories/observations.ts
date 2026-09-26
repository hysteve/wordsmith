/**
 * Recording and reading measurements.
 *
 * Writes go through these functions so the honesty rules cannot be bypassed:
 * a position is only stored when the quality is "measured", and a blocked
 * check is never written as an absence. Reads are the queries the UI needs —
 * latest value, and history for a trend.
 */
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db.ts";
import {
  auditFindings,
  auditRuns,
  completions,
  coverageObservations,
  pageTerms,
  pages,
  rankObservations,
  serpResults,
  type Quality,
} from "../schema.ts";

export type RankObservation = typeof rankObservations.$inferSelect;

/** ranked | not_in_results | blocked | error, and what each means for quality. */
function qualityForRankStatus(status: string): Quality {
  switch (status) {
    case "ranked":
      return "measured";
    case "not_in_results":
      return "absent";
    case "blocked":
      return "blocked";
    default:
      return "blocked"; // an errored check is absence of data, never a zero
  }
}

export async function recordRanking(input: {
  runId: number;
  siteId?: number | null;
  phrase: string;
  status: string;
  position?: number | null;
  reason?: string | null;
  totalResults?: number | null;
}): Promise<RankObservation> {
  const database = await db();
  const quality = qualityForRankStatus(input.status);

  const [row] = await database
    .insert(rankObservations)
    .values({
      runId: input.runId,
      siteId: input.siteId ?? null,
      phrase: input.phrase,
      // A position only means something when we actually saw the result.
      position: quality === "measured" ? (input.position ?? null) : null,
      status: input.status,
      quality,
      reason: input.reason ?? null,
      totalResults: input.totalResults ?? null,
    })
    .returning();
  return row;
}

/** The SERP behind a ranking check — who else was on the page. */
export async function recordSerp(
  runId: number,
  phrase: string,
  results: Array<{ rank: number; url: string; title?: string | null }>,
): Promise<number> {
  if (!results.length) return 0;
  const database = await db();
  await database.insert(serpResults).values(
    results.map((r) => ({
      runId,
      phrase,
      rank: r.rank,
      url: r.url,
      host: hostOf(r.url),
      title: r.title ?? null,
    })),
  );
  return results.length;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function recordCoverage(input: {
  runId: number;
  siteId?: number | null;
  phrase: string;
  url: string;
  present: boolean;
  occurrences?: number;
}): Promise<void> {
  const database = await db();
  await database.insert(coverageObservations).values({
    runId: input.runId,
    siteId: input.siteId ?? null,
    phrase: input.phrase,
    url: input.url,
    present: input.present,
    occurrences: input.occurrences ?? 0,
  });
}

/**
 * Completion order is a popularity proxy, never a volume figure, so these
 * rows are written with quality "proxy" and nothing downstream may promote
 * them to a measurement.
 */
export async function recordCompletions(
  runId: number,
  seed: string,
  groups: Array<{ query: string; completions: string[] }>,
): Promise<number> {
  const rows = groups.flatMap((group) =>
    group.completions.map((phrase, i) => ({
      runId,
      seed,
      query: group.query,
      phrase,
      position: i + 1,
    })),
  );
  if (!rows.length) return 0;
  const database = await db();
  await database.insert(completions).values(rows);
  return rows.length;
}

export async function recordPageTerms(input: {
  runId: number;
  siteId?: number | null;
  url: string;
  words: Array<[string, number]>;
  pairs: Array<[string, number]>;
  triplets: Array<[string, number]>;
}): Promise<number> {
  const rows = [
    ...input.words.map(([term, count]) => ({ term, count, n: 1 })),
    ...input.pairs.map(([term, count]) => ({ term, count, n: 2 })),
    ...input.triplets.map(([term, count]) => ({ term, count, n: 3 })),
  ].map((r) => ({
    ...r,
    runId: input.runId,
    siteId: input.siteId ?? null,
    url: input.url,
  }));

  if (!rows.length) return 0;
  const database = await db();
  await database.insert(pageTerms).values(rows);
  return rows.length;
}

export async function recordAudit(input: {
  runId: number;
  siteId?: number | null;
  url: string;
  auditType: string;
  score?: number | null;
  data?: unknown;
  screenshotPath?: string | null;
  findings?: Array<{
    severity: string;
    code?: string | null;
    message: string;
    detail?: unknown;
  }>;
}): Promise<number> {
  const database = await db();
  const [audit] = await database
    .insert(auditRuns)
    .values({
      runId: input.runId,
      siteId: input.siteId ?? null,
      url: input.url,
      auditType: input.auditType,
      score: input.score ?? null,
      data: input.data ?? null,
      screenshotPath: input.screenshotPath ?? null,
    })
    .returning();

  if (input.findings?.length) {
    await database.insert(auditFindings).values(
      input.findings.map((f) => ({
        auditRunId: audit.id,
        severity: f.severity,
        code: f.code ?? null,
        message: f.message,
        detail: f.detail ?? null,
      })),
    );
  }
  return audit.id;
}

export async function recordPages(
  runId: number,
  siteId: number | null,
  found: Array<{ url: string; depth?: number; title?: string | null }>,
): Promise<number> {
  if (!found.length) return 0;
  const database = await db();
  await database
    .insert(pages)
    .values(
      found.map((p) => ({
        runId,
        siteId,
        url: p.url,
        depth: p.depth ?? null,
        title: p.title ?? null,
      })),
    )
    .onConflictDoNothing();
  return found.length;
}

/* -------------------------------------------------------------- retrieval */

/** Every check for a phrase, oldest first — the shape a trend line wants. */
export async function rankHistory(
  phrase: string,
  options: { siteId?: number; since?: string; limit?: number } = {},
): Promise<RankObservation[]> {
  const database = await db();
  return database
    .select()
    .from(rankObservations)
    .where(
      and(
        eq(rankObservations.phrase, phrase),
        options.siteId
          ? eq(rankObservations.siteId, options.siteId)
          : undefined,
        options.since
          ? gte(rankObservations.observedAt, options.since)
          : undefined,
      ),
    )
    .orderBy(rankObservations.observedAt)
    .limit(options.limit ?? 500);
}

/**
 * The most recent check per phrase for a site.
 *
 * Blocked checks are included rather than filtered out — the caller needs to
 * know a phrase was last seen blocked, not be shown a stale number as if it
 * were current.
 */
export async function latestRanks(
  siteId: number,
  phrases?: string[],
): Promise<RankObservation[]> {
  const database = await db();

  // Newest is by id, not by observed_at. Timestamps have second resolution, so
  // two checks of the same phrase within a second tie and max() returns both.
  // Ids are monotonic, so they order the rows unambiguously.
  const newest = database
    .select({
      phrase: rankObservations.phrase,
      maxId: sql<number>`max(${rankObservations.id})`.as("max_id"),
    })
    .from(rankObservations)
    .where(
      and(
        eq(rankObservations.siteId, siteId),
        phrases?.length ? inArray(rankObservations.phrase, phrases) : undefined,
      ),
    )
    .groupBy(rankObservations.phrase)
    .as("newest");

  return database
    .select({
      id: rankObservations.id,
      runId: rankObservations.runId,
      siteId: rankObservations.siteId,
      phrase: rankObservations.phrase,
      position: rankObservations.position,
      status: rankObservations.status,
      quality: rankObservations.quality,
      reason: rankObservations.reason,
      totalResults: rankObservations.totalResults,
      observedAt: rankObservations.observedAt,
    })
    .from(rankObservations)
    .innerJoin(newest, eq(rankObservations.id, newest.maxId));
}

/**
 * The most recent coverage check per phrase for a site.
 *
 * Keyed on the row id for the same reason as latestRanks: observed_at has
 * second resolution, so several phrases checked in one pass tie on time.
 */
export async function latestCoverage(siteId: number, phrases?: string[]) {
  const database = await db();

  const newest = database
    .select({
      phrase: coverageObservations.phrase,
      maxId: sql<number>`max(${coverageObservations.id})`.as("max_id"),
    })
    .from(coverageObservations)
    .where(
      and(
        eq(coverageObservations.siteId, siteId),
        phrases?.length
          ? inArray(coverageObservations.phrase, phrases)
          : undefined,
      ),
    )
    .groupBy(coverageObservations.phrase)
    .as("newest");

  return database
    .select({
      id: coverageObservations.id,
      runId: coverageObservations.runId,
      phrase: coverageObservations.phrase,
      url: coverageObservations.url,
      present: coverageObservations.present,
      occurrences: coverageObservations.occurrences,
      quality: coverageObservations.quality,
      observedAt: coverageObservations.observedAt,
    })
    .from(coverageObservations)
    .innerJoin(newest, eq(coverageObservations.id, newest.maxId));
}

/**
 * What the site says right now: terms from its most recent scan, with how
 * often each appears and on how many pages.
 *
 * This is the *live* side of the keyword picture and is deliberately separate
 * from the cloud's target list. A phrase can be all over the site and not be
 * targeted, or be targeted and appear nowhere — the gap between the two is the
 * work.
 */
export async function siteTerms(
  siteId: number,
  options: { limit?: number; minCount?: number; maxTokens?: number } = {},
) {
  const database = await db();

  // One scan, not a blend of several: counts from different crawls are not
  // comparable, and summing them would inflate anything scanned twice.
  const [newest] = await database
    .select({ runId: pageTerms.runId })
    .from(pageTerms)
    .where(eq(pageTerms.siteId, siteId))
    .orderBy(desc(pageTerms.id))
    .limit(1);
  if (!newest) return [];

  return database
    .select({
      term: pageTerms.term,
      n: pageTerms.n,
      total: sql<number>`sum(${pageTerms.count})`,
      pages: sql<number>`count(distinct ${pageTerms.url})`,
      observedAt: sql<string>`max(${pageTerms.observedAt})`,
    })
    .from(pageTerms)
    .where(
      and(
        eq(pageTerms.siteId, siteId),
        eq(pageTerms.runId, newest.runId),
        options.maxTokens ? lte(pageTerms.n, options.maxTokens) : undefined,
      ),
    )
    .groupBy(pageTerms.term, pageTerms.n)
    .having(sql`sum(${pageTerms.count}) >= ${options.minCount ?? 2}`)
    .orderBy(desc(sql`sum(${pageTerms.count})`))
    .limit(options.limit ?? 200);
}

/** When the live picture was last taken, so the UI can say how stale it is. */
export async function lastSiteScan(siteId: number): Promise<string | null> {
  const database = await db();
  const [row] = await database
    .select({ observedAt: pageTerms.observedAt })
    .from(pageTerms)
    .where(eq(pageTerms.siteId, siteId))
    .orderBy(desc(pageTerms.id))
    .limit(1);
  return row?.observedAt ?? null;
}

/** Latest audit of each type for a URL, newest first. */
export async function latestAudits(url: string) {
  const database = await db();
  return database
    .select()
    .from(auditRuns)
    .where(eq(auditRuns.url, url))
    .orderBy(desc(auditRuns.observedAt))
    .limit(50);
}

/** Who keeps showing up in the SERP for a phrase, and how often. */
export async function serpCompetitors(phrase: string, limit = 20) {
  const database = await db();
  return database
    .select({
      host: serpResults.host,
      appearances: sql<number>`count(*)`,
      bestRank: sql<number>`min(${serpResults.rank})`,
    })
    .from(serpResults)
    .where(eq(serpResults.phrase, phrase))
    .groupBy(serpResults.host)
    .orderBy(sql`min(${serpResults.rank})`)
    .limit(limit);
}
