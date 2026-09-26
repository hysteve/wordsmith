/**
 * The keyword cloud's pure logic: phrase normalization, the role ladder, and
 * the containment lattice. This is the part the rest of the tool reasons with,
 * so it is the part worth pinning down.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  STATUS,
  ROLE,
  normalizePhrase,
  tokenize,
  deriveRole,
  isQuestion,
  roleOf,
  contains,
  ancestorsOf,
  descendantsOf,
  rollUp,
  addTerm,
  promoteTerm,
  rejectTerm,
  findTerm,
  getKeywords,
  getQueries,
} from "./cloud.js";

/** A cloud document with no I/O behind it. */
function emptyCloud() {
  return { name: "test", target: null, terms: [], rankings: [], coverage: [] };
}

test("normalizePhrase collapses the ways the same phrase gets typed", () => {
  assert.equal(normalizePhrase("  Emergency   Lights  "), "emergency lights");
  assert.equal(normalizePhrase("Don’t Panic"), "don't panic");
  assert.equal(normalizePhrase(null), "");
  assert.equal(normalizePhrase(undefined), "");
});

test("a phrase cannot enter a cloud twice under different spellings", () => {
  const cloud = emptyCloud();
  assert.equal(addTerm(cloud, "Emergency  Lights").outcome, "added");
  assert.equal(addTerm(cloud, "emergency lights").outcome, "known");
  assert.equal(cloud.terms.length, 1);
});

test("role is derived from token count", () => {
  assert.equal(deriveRole("lights"), ROLE.HEAD);
  assert.equal(deriveRole("emergency lights"), ROLE.HEAD);
  assert.equal(deriveRole("emergency vehicle lights"), ROLE.TARGET);
  assert.equal(deriveRole("best emergency vehicle lights"), ROLE.TARGET);
  assert.equal(
    deriveRole("what are the best emergency lights"),
    ROLE.UTTERANCE,
  );
});

test("roleOverride beats the derived role", () => {
  const term = {
    phrase: "emergency lights",
    role: ROLE.HEAD,
    roleOverride: ROLE.TARGET,
  };
  assert.equal(roleOf(term), ROLE.TARGET);
  assert.equal(
    roleOf({ phrase: "emergency lights", role: ROLE.HEAD, roleOverride: null }),
    ROLE.HEAD,
  );
});

test("isQuestion catches both the mark and the leading question word", () => {
  assert.ok(isQuestion("how do i install a light bar"));
  assert.ok(isQuestion("emergency lights?"));
  assert.ok(!isQuestion("emergency light bars"));
});

test("containment is strict: a phrase does not contain itself", () => {
  assert.ok(contains("lights", "emergency lights"));
  assert.ok(!contains("emergency lights", "lights"));
  assert.ok(!contains("lights", "lights"));
  assert.ok(!contains("", "lights"));
  // Order does not matter; containment is over the token set.
  assert.ok(contains("lights emergency", "best emergency vehicle lights"));
});

test("ancestors and descendants are opposite ends of the same relation", () => {
  const cloud = emptyCloud();
  for (const p of [
    "lights",
    "emergency lights",
    "best emergency vehicle lights",
  ]) {
    addTerm(cloud, p);
  }
  assert.deepEqual(
    ancestorsOf(cloud, "best emergency vehicle lights").map((t) => t.phrase),
    ["lights", "emergency lights"],
  );
  assert.deepEqual(
    descendantsOf(cloud, "lights").map((t) => t.phrase),
    ["emergency lights", "best emergency vehicle lights"],
  );
});

test("rejecting a term is permanent — re-proposing does not resurrect it", () => {
  const cloud = emptyCloud();
  addTerm(cloud, "cheap lights");
  rejectTerm(cloud, "cheap lights");

  const again = addTerm(cloud, "cheap lights", { tool: "googled" });
  assert.equal(again.outcome, "rejected");
  assert.equal(findTerm(cloud, "cheap lights").status, STATUS.REJECTED);
  // ...but the new sighting is still recorded, which is signal when reviewing.
  assert.equal(findTerm(cloud, "cheap lights").sources.length, 2);
});

test("the same tool proposing the same phrase twice records one source", () => {
  const cloud = emptyCloud();
  addTerm(cloud, "light bars", { tool: "googled", detail: "seed:lights" });
  addTerm(cloud, "light bars", { tool: "googled", detail: "seed:lights" });
  assert.equal(findTerm(cloud, "light bars").sources.length, 1);

  addTerm(cloud, "light bars", { tool: "keywords", detail: "seed:lights" });
  assert.equal(findTerm(cloud, "light bars").sources.length, 2);
});

test("promotion moves a candidate into the core set and stamps it", () => {
  const cloud = emptyCloud();
  addTerm(cloud, "light bars");
  assert.equal(findTerm(cloud, "light bars").status, STATUS.CANDIDATE);
  assert.equal(findTerm(cloud, "light bars").promotedAt, null);

  const term = promoteTerm(cloud, "light bars");
  assert.equal(term.status, STATUS.CORE);
  assert.ok(term.promotedAt, "promotedAt is recorded");
});

test("promoting or rejecting an untracked phrase is an error, not a silent no-op", () => {
  const cloud = emptyCloud();
  assert.throws(() => promoteTerm(cloud, "nope"), /Not in cloud/);
  assert.throws(() => rejectTerm(cloud, "nope"), /Not in cloud/);
});

test("keywords and queries partition the cloud by role", () => {
  const cloud = emptyCloud();
  addTerm(cloud, "lights"); // head
  addTerm(cloud, "emergency vehicle lights"); // target
  addTerm(cloud, "what are the best emergency lights"); // utterance

  assert.deepEqual(
    getKeywords(cloud).map((t) => t.phrase),
    ["lights", "emergency vehicle lights"],
  );
  assert.deepEqual(
    getQueries(cloud).map((t) => t.phrase),
    ["what are the best emergency lights"],
  );
});

test("rollUp reports a head term with no ranking descendants as unsupported", () => {
  const cloud = emptyCloud();
  addTerm(cloud, "lights");
  addTerm(cloud, "emergency vehicle lights");

  const bare = rollUp(cloud, "lights");
  assert.equal(bare.descendants, 1);
  assert.equal(bare.descendantsRanked, 0);
  assert.equal(bare.bestDescendant, null);
  assert.equal(bare.position, null);
});

test("rollUp uses the most recent ranking per phrase and finds the best descendant", () => {
  const cloud = emptyCloud();
  addTerm(cloud, "lights");
  addTerm(cloud, "emergency vehicle lights");
  addTerm(cloud, "best emergency vehicle lights");

  cloud.rankings = [
    {
      phrase: "emergency vehicle lights",
      position: 30,
      status: "ranked",
      checkedAt: "2026-01-01T00:00:00Z",
    },
    {
      phrase: "emergency vehicle lights",
      position: 4,
      status: "ranked",
      checkedAt: "2026-02-01T00:00:00Z",
    },
    {
      phrase: "best emergency vehicle lights",
      position: 9,
      status: "ranked",
      checkedAt: "2026-02-01T00:00:00Z",
    },
  ];

  const rolled = rollUp(cloud, "lights");
  assert.equal(rolled.descendants, 2);
  assert.equal(rolled.descendantsRanked, 2);
  // The newer check (4) wins over the older one (30) for the same phrase.
  assert.equal(rolled.bestDescendant.position, 4);
});

test("rollUp ignores rankings that failed rather than counting them as results", () => {
  const cloud = emptyCloud();
  addTerm(cloud, "lights");
  addTerm(cloud, "emergency vehicle lights");
  cloud.rankings = [
    {
      phrase: "emergency vehicle lights",
      position: 2,
      status: "blocked",
      checkedAt: "2026-02-01T00:00:00Z",
    },
  ];
  assert.equal(rollUp(cloud, "lights").descendantsRanked, 0);
});
