/**
 * Jobs and runs, as one timeline.
 *
 * They were two pages, which made them look like two systems. They are one
 * thing seen at two moments: a queued job becomes a run the instant the worker
 * claims it, and a CLI invocation is a run that never had a job. Splitting
 * them meant "what has this tool been doing" needed two screens and a mental
 * join.
 *
 * So the join happens here rather than in a page. Two queries, merged and
 * sorted, because the alternative is a UNION of two different row shapes for
 * no gain at this size.
 */
import {
  and,
  desc,
  eq,
  isNotNull,
  isNull,
  inArray,
  notInArray,
  sql,
} from "drizzle-orm";
import { db } from "../db.ts";
import { jobs, runs } from "../schema.ts";

export type ActivityItem = {
  /** Stable key for rendering: a run id when there is one, else the job id. */
  key: string;
  runId: number | null;
  jobId: number | null;
  /** The run's tool, or the job's kind before a run exists. */
  tool: string;
  target: string | null;
  /** queued | running | done | failed | cancelled | ok | error */
  status: string;
  progress: string | null;
  error: string | null;
  result: unknown;
  /** Where the work came from. */
  source: "queue" | "cli";
  /** What to sort and display by. */
  at: string;
  startedAt: string | null;
  finishedAt: string | null;
  attempts: number | null;
};

/**
 * A run and its job disagree about status wording — a run is ok/error/running
 * while a job is done/failed/queued. The job's is the one a person queued and
 * is watching, so it wins when present.
 */
function unifyStatus(
  runStatus: string | null,
  jobStatus: string | null,
): string {
  return jobStatus ?? runStatus ?? "unknown";
}

export async function recentActivity(limit = 60): Promise<ActivityItem[]> {
  const database = await db();

  // Every run, with the job that caused it when there was one.
  const runRows = await database
    .select({
      runId: runs.id,
      tool: runs.tool,
      target: runs.target,
      runStatus: runs.status,
      runError: runs.error,
      startedAt: runs.startedAt,
      finishedAt: runs.finishedAt,
      jobId: jobs.id,
      jobKind: jobs.kind,
      jobStatus: jobs.status,
      jobProgress: jobs.progress,
      jobError: jobs.error,
      jobResult: jobs.result,
      attempts: jobs.attempts,
    })
    .from(runs)
    .leftJoin(jobs, eq(runs.jobId, jobs.id))
    .orderBy(desc(runs.startedAt), desc(runs.id))
    .limit(limit);

  // Jobs that have not produced a run yet: queued, cancelled, or failed before
  // a handler could start. Without these the queue would look empty while work
  // was waiting.
  const claimed = runRows
    .map((r) => r.jobId)
    .filter((id): id is number => id !== null);
  const pendingRows = await database
    .select()
    .from(jobs)
    .where(
      claimed.length
        ? and(notInArray(jobs.id, claimed), isNull(jobs.startedAt))
        : isNull(jobs.startedAt),
    )
    .orderBy(desc(jobs.id))
    .limit(limit);

  const fromRuns: ActivityItem[] = runRows.map((r) => ({
    key: `run-${r.runId}`,
    runId: r.runId,
    jobId: r.jobId,
    tool: r.tool ?? r.jobKind ?? "unknown",
    target: r.target,
    status: unifyStatus(r.runStatus, r.jobStatus),
    progress: r.jobProgress,
    error: r.jobError ?? r.runError,
    result: r.jobResult ?? null,
    source: r.jobId ? "queue" : "cli",
    at: r.finishedAt ?? r.startedAt,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    attempts: r.attempts,
  }));

  const fromJobs: ActivityItem[] = pendingRows.map((j) => ({
    key: `job-${j.id}`,
    runId: null,
    jobId: j.id,
    tool: j.kind,
    target: targetOf(j.payload),
    status: j.status,
    progress: j.progress,
    error: j.error,
    result: j.result ?? null,
    source: "queue",
    at: j.finishedAt ?? j.created,
    startedAt: j.startedAt,
    finishedAt: j.finishedAt,
    attempts: j.attempts,
  }));

  return [...fromRuns, ...fromJobs]
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
    .slice(0, limit);
}

/** A job's payload names its subject differently per kind. */
function targetOf(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.url === "string") return p.url;
  if (typeof p.target === "string") return p.target;
  if (typeof p.seed === "string") return p.seed;
  if (typeof p.cloud === "string") return p.cloud;
  if (Array.isArray(p.phrases)) return `${p.phrases.length} phrase(s)`;
  return null;
}

/** True when anything is queued or in flight, so a page knows to keep polling. */
export async function hasActiveWork(): Promise<boolean> {
  const database = await db();
  const [row] = await database
    .select({ n: sql<number>`count(*)` })
    .from(jobs)
    .where(inArray(jobs.status, ["queued", "running"]));
  return Number(row?.n ?? 0) > 0;
}
