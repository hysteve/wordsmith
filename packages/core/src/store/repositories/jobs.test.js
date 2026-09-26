/**
 * The job queue, against a real temporary database.
 *
 * The first version of this queue never ran a single job: `run_after` was
 * written with `toISOString()` while the claim predicate compared it against
 * SQLite's `datetime('now')`, and because those are compared as text and 'T'
 * sorts after ' ', nothing was ever eligible. Nothing failed — jobs simply sat
 * in "queued" forever. Hence the eligibility tests below.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wordsmith-jobs-"));
process.env.WORDSMITH_DB_URL = `file:${path.join(tmp, "jobs.db")}`;

const { closeDb } = await import("../db.ts");
const jobs = await import("./jobs.ts");

test.after(async () => {
  await closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("an enqueued job is immediately claimable", async () => {
  const created = await jobs.enqueue("keywords", { url: "example.com" });
  assert.equal(created.status, "queued");

  const claimed = await jobs.claimNext();
  assert.ok(claimed, "a freshly enqueued job must be eligible right away");
  assert.equal(claimed.id, created.id);
  assert.equal(claimed.status, "running");
  assert.equal(claimed.attempts, 1);
  assert.ok(claimed.startedAt, "claiming stamps startedAt");

  await jobs.completeJob(claimed.id, { ok: true });
});

test("run_after is stored in the format the claim query compares against", async () => {
  const created = await jobs.enqueue("keywords", {});
  // The claim predicate is `run_after <= datetime('now')`, compared as text.
  assert.match(
    created.runAfter,
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    "an ISO timestamp here makes every job permanently ineligible",
  );
  await jobs.cancelJob(created.id);
});

test("a delayed job is not claimable yet", async () => {
  const delayed = await jobs.enqueue("keywords", {}, { delayMs: 60_000 });
  const claimed = await jobs.claimNext();
  assert.notEqual(claimed?.id, delayed.id);
  if (claimed) await jobs.completeJob(claimed.id, null);
  await jobs.cancelJob(delayed.id);
});

test("nothing to do returns undefined rather than throwing", async () => {
  let job;
  while ((job = await jobs.claimNext())) await jobs.completeJob(job.id, null);
  assert.equal(await jobs.claimNext(), undefined);
});

test("two claims never get the same job", async () => {
  await jobs.enqueue("keywords", { n: 1 });
  const [a, b] = await Promise.all([jobs.claimNext(), jobs.claimNext()]);
  const claimed = [a, b].filter(Boolean);
  assert.equal(claimed.length, 1, "exactly one claimant wins");
  await jobs.completeJob(claimed[0].id, null);
});

test("higher priority runs first", async () => {
  const low = await jobs.enqueue("keywords", { tag: "low" }, { priority: 0 });
  const high = await jobs.enqueue(
    "keywords",
    { tag: "high" },
    { priority: 10 },
  );

  const first = await jobs.claimNext();
  assert.equal(first.id, high.id);
  await jobs.completeJob(first.id, null);

  const second = await jobs.claimNext();
  assert.equal(second.id, low.id);
  await jobs.completeJob(second.id, null);
});

test("kinds filter what a worker will pick up", async () => {
  const audit = await jobs.enqueue("audit", { url: "example.com" });
  const claimed = await jobs.claimNext(["keywords"]);
  assert.equal(claimed, undefined, "a worker only takes kinds it handles");

  const right = await jobs.claimNext(["audit"]);
  assert.equal(right.id, audit.id);
  await jobs.completeJob(right.id, null);
});

test("a failure reschedules with backoff while attempts remain", async () => {
  const job = await jobs.enqueue("keywords", {}, { maxAttempts: 2 });
  const claimed = await jobs.claimNext();

  const retrying = await jobs.failJob(claimed.id, new Error("network died"));
  assert.equal(retrying, true);

  const after = await jobs.getJob(job.id);
  assert.equal(after.status, "queued");
  assert.match(after.error, /network died/);
  assert.equal(after.startedAt, null, "a rescheduled job is not still running");
  // Backed off, so a site that is down is not hammered.
  assert.ok(
    after.runAfter > after.created,
    "the retry is pushed into the future",
  );

  await jobs.cancelJob(job.id);
});

test("a job fails for good once its attempts are used up", async () => {
  // attempts increments on claim, so one attempt means one claim.
  const job = await jobs.enqueue("keywords", {}, { maxAttempts: 1 });
  const claimed = await jobs.claimNext();
  assert.equal(claimed.attempts, 1);

  const retrying = await jobs.failJob(claimed.id, new Error("final"));
  assert.equal(retrying, false);

  const done = await jobs.getJob(job.id);
  assert.equal(done.status, "failed");
  assert.match(done.error, /final/);
  assert.ok(done.finishedAt);
});

test("only work that has not started can be cancelled", async () => {
  const queued = await jobs.enqueue("keywords", {});
  assert.equal(await jobs.cancelJob(queued.id), true);
  assert.equal((await jobs.getJob(queued.id)).status, "cancelled");

  const running = await jobs.enqueue("keywords", {});
  const claimed = await jobs.claimNext();
  assert.equal(claimed.id, running.id);
  assert.equal(
    await jobs.cancelJob(running.id),
    false,
    "a running job owns a browser context and has to finish or fail",
  );
  await jobs.completeJob(running.id, null);
});

test("jobs stranded by a crashed worker are requeued", async () => {
  await jobs.enqueue("keywords", {});
  const claimed = await jobs.claimNext();
  assert.equal(claimed.status, "running");

  // Simulate the worker dying mid-job.
  const requeued = await jobs.requeueStranded();
  assert.ok(requeued >= 1);

  const back = await jobs.getJob(claimed.id);
  assert.equal(back.status, "queued");
  assert.equal(back.startedAt, null);
  await jobs.cancelJob(back.id);
});

test("the payload survives the round trip as an object", async () => {
  const payload = {
    url: "example.com",
    phrases: ["a b", "c"],
    nested: { n: 1 },
  };
  const created = await jobs.enqueue("coverage", payload);
  const read = await jobs.getJob(created.id);
  assert.deepEqual(read.payload, payload);
  await jobs.cancelJob(created.id);
});
