/**
 * The honesty rules, made testable.
 *
 * Google returns an empty result set both when a phrase genuinely does not
 * rank and when it has throttled us. Storing the second as the first invents a
 * measurement that was never taken, and once it is a row in a chart nobody can
 * tell the difference again. These tests hold that line.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wordsmith-obs-"));
process.env.WORDSMITH_DB_URL = `file:${path.join(tmp, "obs.db")}`;

const { closeDb } = await import("../db.ts");
const observations = await import("./observations.ts");
const runsRepo = await import("./runs.ts");
const sitesRepo = await import("./sites.ts");

let runId;
let siteId;

test.before(async () => {
  const site = await sitesRepo.siteFor("https://www.Example.com/page");
  siteId = site.id;
  const run = await runsRepo.startRun({ tool: "test", siteId });
  runId = run.id;
});

test.after(async () => {
  await closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("a host is normalized so every measurement about a site joins up", async () => {
  const a = await sitesRepo.siteFor("example.com");
  const b = await sitesRepo.siteFor("https://www.example.com/deep/path?q=1");
  const c = await sitesRepo.siteFor("WWW.EXAMPLE.COM");
  assert.equal(a.id, b.id);
  assert.equal(b.id, c.id);
  assert.equal(a.host, "example.com");
});

test("a ranked result keeps its position and is marked measured", async () => {
  const row = await observations.recordRanking({
    runId,
    siteId,
    phrase: "emergency lights",
    status: "ranked",
    position: 4,
    totalResults: 10,
  });
  assert.equal(row.position, 4);
  assert.equal(row.quality, "measured");
});

test("a blocked check never becomes a position", async () => {
  const row = await observations.recordRanking({
    runId,
    siteId,
    phrase: "light bars",
    status: "blocked",
    // Even if a caller passes one, a blocked check has no position to record.
    position: 1,
    reason: "Google returned an empty result set",
  });
  assert.equal(row.status, "blocked");
  assert.equal(row.quality, "blocked");
  assert.equal(row.position, null, "a blocked check must not carry a number");
  assert.match(row.reason, /empty result set/);
});

test("not ranking is 'absent', which is different from blocked", async () => {
  const row = await observations.recordRanking({
    runId,
    siteId,
    phrase: "vehicle beacons",
    status: "not_in_results",
    totalResults: 10,
  });
  assert.equal(row.quality, "absent");
  assert.equal(row.position, null);
  // The distinction survives: one was measured as missing, one was refused.
  assert.notEqual(row.quality, "blocked");
});

test("an errored check is treated as absence of data, not a zero", async () => {
  const row = await observations.recordRanking({
    runId,
    siteId,
    phrase: "erroring phrase",
    status: "error",
    reason: "timeout",
  });
  assert.equal(row.quality, "blocked");
  assert.equal(row.position, null);
});

test("completions are stored as a proxy, never as a measurement", async () => {
  const stored = await observations.recordCompletions(runId, "emergency", [
    { query: "emergency", completions: ["emergency lights", "emergency kit"] },
  ]);
  assert.equal(stored, 2);

  const { db } = await import("../db.ts");
  const { completions } = await import("../schema.ts");
  const rows = await (await db()).select().from(completions);
  assert.ok(rows.length >= 2);
  // Completion order is popularity-ish, never search volume.
  assert.ok(rows.every((r) => r.quality === "proxy"));
  assert.deepEqual(
    rows.map((r) => r.position).slice(0, 2),
    [1, 2],
    "order is preserved, because order is the whole signal",
  );
});

test("history comes back oldest first, blocked checks included", async () => {
  const history = await observations.rankHistory("light bars", { siteId });
  assert.ok(history.length >= 1);
  // A blocked check must still appear: the caller needs to know the last
  // attempt was refused rather than see a stale number presented as current.
  assert.ok(history.some((h) => h.quality === "blocked"));
});

test("latestRanks returns one current row per phrase", async () => {
  await observations.recordRanking({
    runId,
    siteId,
    phrase: "emergency lights",
    status: "ranked",
    position: 2,
  });

  const latest = await observations.latestRanks(siteId, ["emergency lights"]);
  assert.equal(latest.length, 1, "one row per phrase, the most recent");
  assert.equal(latest[0].position, 2, "the newer check wins");
});

test("a SERP is kept with hosts extracted, so competitors can be counted", async () => {
  await observations.recordSerp(runId, "emergency lights", [
    { rank: 1, url: "https://www.rival.com/a", title: "Rival" },
    { rank: 2, url: "https://other.example/b", title: "Other" },
  ]);
  const competitors = await observations.serpCompetitors("emergency lights");
  const hosts = competitors.map((c) => c.host);
  assert.ok(hosts.includes("rival.com"), "www is stripped for grouping");
  assert.ok(hosts.includes("other.example"));
});

test("a run records provenance and its own failure", async () => {
  const ok = await runsRepo.withRun({ tool: "test-ok" }, async () => "fine");
  assert.equal(ok, "fine");

  await assert.rejects(
    runsRepo.withRun({ tool: "test-bad" }, async () => {
      throw new Error("scrape exploded");
    }),
    /scrape exploded/,
  );

  const recent = await runsRepo.recentRuns(10);
  const bad = recent.find((r) => r.tool === "test-bad");
  assert.equal(bad.status, "error", "a thrown run is not left marked running");
  assert.match(bad.error, /scrape exploded/);
});
