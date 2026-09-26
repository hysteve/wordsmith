/**
 * A run is one tool invocation, and the provenance for every measurement it
 * produced. Every number the UI shows can name the run behind it — when it was
 * taken, with what arguments, and whether the run itself succeeded.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "../db.ts";
import { sqliteTime } from "../time.ts";
import { runs } from "../schema.ts";

export type Run = typeof runs.$inferSelect;

export type StartRun = {
  tool: string;
  target?: string | null;
  siteId?: number | null;
  params?: unknown;
  jobId?: number | null;
};

export async function startRun(input: StartRun): Promise<Run> {
  const database = await db();
  const [run] = await database
    .insert(runs)
    .values({
      tool: input.tool,
      target: input.target ?? null,
      siteId: input.siteId ?? null,
      params: input.params ?? null,
      jobId: input.jobId ?? null,
      status: "running",
    })
    .returning();
  return run;
}

export async function finishRun(id: number): Promise<void> {
  const database = await db();
  await database
    .update(runs)
    .set({ status: "ok", finishedAt: sqliteTime() })
    .where(eq(runs.id, id));
}

export async function failRun(id: number, error: unknown): Promise<void> {
  const database = await db();
  await database
    .update(runs)
    .set({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      finishedAt: sqliteTime(),
    })
    .where(eq(runs.id, id));
}

/**
 * Run `fn` inside a run record, so a tool cannot produce measurements without
 * provenance and cannot leave a run marked "running" after it throws.
 */
export async function withRun<T>(
  input: StartRun,
  fn: (run: Run) => Promise<T>,
): Promise<T> {
  const run = await startRun(input);
  try {
    const result = await fn(run);
    await finishRun(run.id);
    return result;
  } catch (error) {
    await failRun(run.id, error);
    throw error;
  }
}

export async function recentRuns(limit = 50): Promise<Run[]> {
  const database = await db();
  return database
    .select()
    .from(runs)
    .orderBy(desc(runs.startedAt))
    .limit(limit);
}

export async function getRun(id: number): Promise<Run | undefined> {
  const database = await db();
  const [row] = await database.select().from(runs).where(eq(runs.id, id));
  return row;
}
