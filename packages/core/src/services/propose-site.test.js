/**
 * Telling a site's subject apart from its navigation.
 *
 * Reading one page is a bad sample, and it showed: shantikava.com's homepage
 * is ~2,000 characters, so "root beer" — real text from one menu item —
 * arrived with the same weight as "kava bar". Aggregating across pages fixes
 * that and introduces the opposite failure, because the nav and footer appear
 * on *every* page and win on ubiquity alone.
 *
 * The rule under test is density: chrome appears about once per page because
 * it is one link, while a subject is repeated on the pages about it. The
 * numbers below are the real shapes from that site.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { rankSiteTally } from "./cloud-core.js";

const phrases = (ranked) => ranked.map((r) => r.phrase);

test("a phrase found on one page only is not a theme", () => {
  const ranked = rankSiteTally(
    [
      { phrase: "kava", n: 1, total: 18, pageCount: 3 },
      { phrase: "root beer", n: 2, total: 2, pageCount: 1 },
    ],
    3,
  );
  assert.ok(phrases(ranked).includes("kava"));
  assert.ok(
    !phrases(ranked).includes("root beer"),
    "one page is not evidence of what a site is about",
  );
});

test("navigation is on every page but said once, so it is dropped", () => {
  const ranked = rankSiteTally(
    [
      // The real pair from shantikava.com.
      { phrase: "kava", n: 1, total: 85, pageCount: 14 },
      { phrase: "menu contact", n: 2, total: 14, pageCount: 14 },
      { phrase: "visit us", n: 2, total: 16, pageCount: 14 },
    ],
    14,
  );
  assert.deepEqual(phrases(ranked), ["kava"]);
});

test("a phone number is never a keyword", () => {
  const ranked = rankSiteTally(
    [
      { phrase: "904 907 2296", n: 3, total: 15, pageCount: 14 },
      { phrase: "2296", n: 1, total: 15, pageCount: 14 },
      { phrase: "kava", n: 1, total: 85, pageCount: 14 },
    ],
    14,
  );
  assert.deepEqual(phrases(ranked), ["kava"]);
});

test("a subject confined to a few pages counts when it is dense there", () => {
  // kratom on that site: 4 pages, 57 hits. Not ubiquitous, unmistakably a topic.
  const ranked = rankSiteTally(
    [
      { phrase: "kratom", n: 1, total: 57, pageCount: 4 },
      { phrase: "kava", n: 1, total: 85, pageCount: 14 },
    ],
    14,
  );
  assert.equal(
    phrases(ranked)[0],
    "kratom",
    "density beats mere presence — 14 per page outranks 6",
  );
});

test("ubiquitous boilerplate survives if it is genuinely repeated", () => {
  // The cutoff is density, not ubiquity: a subject named on every page and
  // discussed on each of them is still the subject.
  const ranked = rankSiteTally(
    [{ phrase: "kava", n: 1, total: 85, pageCount: 14 }],
    14,
  );
  assert.deepEqual(phrases(ranked), ["kava"]);
});

test("single words pay a higher bar than phrases", () => {
  const ranked = rankSiteTally(
    [
      // Two pages, modest count: fine for a phrase, not for a bare word.
      { phrase: "wellness", n: 1, total: 5, pageCount: 2 },
      { phrase: "kava bar", n: 2, total: 5, pageCount: 2 },
    ],
    10,
  );
  assert.ok(phrases(ranked).includes("kava bar"));
  assert.ok(!phrases(ranked).includes("wellness"));
});

test("the limit caps how much lands in the candidate queue", () => {
  const many = Array.from({ length: 200 }, (_, i) => ({
    phrase: `phrase ${i}`,
    n: 2,
    total: 10,
    pageCount: 3,
  }));
  assert.equal(rankSiteTally(many, 20, { limit: 25 }).length, 25);
});

test("an empty site yields nothing rather than throwing", () => {
  assert.deepEqual(rankSiteTally([], 0), []);
});
