/**
 * The job queue.
 *
 * An audit is minutes of browser time and a ranking sweep is throttled on
 * purpose, so neither can happen inside an HTTP request — the web UI enqueues
 * and polls. SQLite is a good queue at this scale for the same reason it is a
 * limitation elsewhere: there is one writer, so claiming is simple and cannot
 * race.
 *
 * Claiming is a single conditional UPDATE. Two workers cannot take the same
 * job because the second one's `status = 'queued'` predicate no longer holds
 * by the time it runs.
 */
import { and, asc, desc, eq, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "../db.ts";
import { sqliteTime } from "../time.ts";
import { jobs } from "../schema.ts";

export type Job = typeof jobs.$inferSelect;

export const JOB_STATUS = [
  "queued",
  "running",
  "done",
  "failed",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUS)[number];

export type EnqueueOptions = {
  priority?: number;
  maxAttempts?: number;
  /** Delay before the job becomes eligible. */
  delayMs?: number;
};

export async function enqueue(
  kind: string,
  payload: unknown,
  options: EnqueueOptions = {},
): Promise<Job> {
  const database = await db();
  const runAfter = sqliteTime(new Date(Date.now() + (options.delayMs ?? 0)));

  const [job] = await database
    .insert(jobs)
    .values({
      kind,
      payload: payload ?? {},
      priority: options.priority ?? 0,
      maxAttempts: options.maxAttempts ?? 1,
      runAfter,
    })
    .returning();
  return job;
}

/**
 * Take the next eligible job, highest priority and oldest first.
 * Returns undefined when there is nothing to do.
 */
export async function claimNext(kinds?: string[]): Promise<Job | undefined> {
  const database = await db();

  const eligible = and(
    eq(jobs.status, "queued"),
    lte(jobs.runAfter, sql`datetime('now')`),
    kinds && kinds.length ? inArray(jobs.kind, kinds) : undefined,
  );

  const [next] = await database
    .select({ id: jobs.id })
    .from(jobs)
    .where(eligible)
    .orderBy(desc(jobs.priority), asc(jobs.runAfter), asc(jobs.id))
    .limit(1);
  if (!next) return undefined;

  // The status predicate is what makes this safe: if another worker claimed
  // this row first, zero rows come back and we simply look again.
  const claimed = await database
    .update(jobs)
    .set({
      status: "running",
      startedAt: sqliteTime(),
      attempts: sql`${jobs.attempts} + 1`,
    })
    .where(and(eq(jobs.id, next.id), eq(jobs.status, "queued")))
    .returning();

  return claimed[0] ?? claimNext(kinds);
}

export async function reportProgress(
  id: number,
  progress: string,
): Promise<void> {
  const database = await db();
  await database.update(jobs).set({ progress }).where(eq(jobs.id, id));
}

export async function completeJob(id: number, result: unknown): Promise<void> {
  const database = await db();
  await database
    .update(jobs)
    .set({
      status: "done",
      result: result ?? null,
      progress: null,
      finishedAt: sqliteTime(),
    })
    .where(eq(jobs.id, id));
}

/**
 * Fail a job, retrying with backoff while attempts remain.
 * Returns true when the job was rescheduled rather than finished.
 */
export async function failJob(id: number, error: unknown): Promise<boolean> {
  const database = await db();
  const [job] = await database.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return false;

  const message = error instanceof Error ? error.message : String(error);
  const willRetry = job.attempts < job.maxAttempts;

  if (willRetry) {
    // Exponential backoff, capped, so a site that is down is not hammered.
    const delayMs = Math.min(2 ** job.attempts * 1000, 5 * 60 * 1000);
    await database
      .update(jobs)
      .set({
        status: "queued",
        error: message,
        progress: null,
        startedAt: null,
        runAfter: sqliteTime(new Date(Date.now() + delayMs)),
      })
      .where(eq(jobs.id, id));
    return true;
  }

  await database
    .update(jobs)
    .set({
      status: "failed",
      error: message,
      progress: null,
      finishedAt: sqliteTime(),
    })
    .where(eq(jobs.id, id));
  return false;
}

export async function cancelJob(id: number): Promise<boolean> {
  const database = await db();
  // Only work that has not started can be cancelled; a running job owns a
  // browser and has to be allowed to finish or fail.
  const cancelled = await database
    .update(jobs)
    .set({ status: "cancelled", finishedAt: sqliteTime() })
    .where(and(eq(jobs.id, id), eq(jobs.status, "queued")))
    .returning();
  return cancelled.length > 0;
}

export async function getJob(id: number): Promise<Job | undefined> {
  const database = await db();
  const [row] = await database.select().from(jobs).where(eq(jobs.id, id));
  return row;
}

export async function listJobs(
  options: { status?: JobStatus; kind?: string; limit?: number } = {},
): Promise<Job[]> {
  const database = await db();
  return database
    .select()
    .from(jobs)
    .where(
      and(
        options.status ? eq(jobs.status, options.status) : undefined,
        options.kind ? eq(jobs.kind, options.kind) : undefined,
      ),
    )
    .orderBy(desc(jobs.id))
    .limit(options.limit ?? 50);
}

/**
 * Put jobs left "running" by a crashed worker back on the queue.
 * Call once at worker startup: nothing else can be holding them, because the
 * worker is the only process that claims.
 */
export async function requeueStranded(): Promise<number> {
  const database = await db();
  const requeued = await database
    .update(jobs)
    .set({ status: "queued", startedAt: null, progress: null })
    .where(eq(jobs.status, "running"))
    .returning({ id: jobs.id });
  return requeued.length;
}
