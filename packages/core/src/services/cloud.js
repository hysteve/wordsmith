/**
 * Keyword Cloud — the I/O part: storage, the proposers, and measurement.
 *
 * Research tools *propose* candidate phrases, a human *promotes* the good ones
 * into the core set, and only core terms get ranking- and coverage-checked.
 *
 * The pure logic lives in cloud-core.js and is re-exported here, so existing
 * callers import one module and a consumer that only needs the lattice can
 * import cloud-core.js alone and avoid the browser entirely.
 *
 * Storage is a JSON document per cloud on the local filesystem; every access
 * goes through loadCloud/saveCloud so a database can replace it without
 * touching workflow logic.
 */

import fs from "fs/promises";
import path from "path";
import { extractQueryCompletions } from "../scrapers/googled.js";
import { parseKeywords } from "../scrapers/keywords.js";
import { discoverPages } from "../scrapers/site-pages.js";
import { fetchDatamuseWords } from "../lib/datamuse-api.js";
import {
  measureRankings,
  measureCoverage,
  checkPhraseRanking,
} from "./measure.js";
import { cloudsDir } from "../paths.ts";
import {
  STATUS,
  ROLE,
  normalizePhrase,
  tokenize,
  deriveRole,
  isQuestion,
  roleOf,
  findTerm,
  addTerm,
  getTerms,
  rankSiteTally,
} from "./cloud-core.js";

// The pure surface stays importable from here; callers should not have to know
// which half a function lives in.
export * from "./cloud-core.js";

// checkPhraseRanking moved to measure.js, where the recording lives. Kept
// exported here because callers already import it from this module.
export { checkPhraseRanking };

// Was `process.cwd()/data/clouds`, so your clouds disappeared if you ran the
// CLI from a subdirectory — and WORDSMITH_DATA_DIR bypassed the `clouds`
// subdirectory entirely, so the two paths disagreed. See core/src/paths.ts.
const DATA_DIR = cloudsDir;

/* ------------------------------------------------------------------ store */

function cloudPath(name) {
  return path.join(DATA_DIR(), `${name}.json`);
}

export async function listClouds() {
  try {
    const files = await fs.readdir(DATA_DIR());
    return files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

export async function createCloud(name, target) {
  if (!name) throw new Error("A cloud needs a name");
  const existing = await loadCloud(name).catch(() => null);
  if (existing) throw new Error(`Cloud "${name}" already exists`);
  const now = new Date().toISOString();
  const cloud = {
    name,
    target: target || null,
    created: now,
    updated: now,
    terms: [],
    rankings: [],
    coverage: [],
    gaps: [],
  };
  await saveCloud(cloud);
  return cloud;
}

export async function loadCloud(name) {
  const raw = await fs.readFile(cloudPath(name), "utf8");
  const cloud = JSON.parse(raw);
  // Tolerate documents written by older versions.
  cloud.terms ||= [];
  cloud.rankings ||= [];
  cloud.coverage ||= [];
  cloud.gaps ||= [];
  // Backfill attributes added after a document was first written; roleOf()
  // tolerates their absence, but storing them keeps the JSON inspectable.
  for (const term of cloud.terms) {
    term.tokens ??= tokenize(term.phrase).length;
    term.isQuestion ??= isQuestion(term.phrase);
    term.role ??= deriveRole(term.phrase);
    term.roleOverride ??= null;
    term.assignments ??= [];
  }
  return cloud;
}

export async function saveCloud(cloud) {
  cloud.updated = new Date().toISOString();
  await fs.mkdir(DATA_DIR(), { recursive: true });
  await fs.writeFile(cloudPath(cloud.name), JSON.stringify(cloud, null, 2));
  return cloud;
}

/* -------------------------------------------------------------- proposals */

function summarize(results) {
  return results.reduce(
    (acc, r) => {
      acc[r.outcome] = (acc[r.outcome] || 0) + 1;
      return acc;
    },
    { added: 0, known: 0, rejected: 0, skipped: 0 },
  );
}

/** Live Google query completions for a seed phrase. */
export async function proposeFromCompletions(cloud, seed, options = {}) {
  const groups = await extractQueryCompletions(seed, {
    cascade: options.cascade ?? false,
    delay: options.delay ?? 1200,
    limit: options.limit ?? 10,
  });
  const results = [];
  for (const group of groups || []) {
    for (const completion of group.completions || []) {
      // Completions are suffixes; the full phrase is query + completion.
      const phrase = `${group.query} ${completion}`;
      results.push(
        addTerm(cloud, phrase, {
          tool: "googled",
          detail: `seed: ${group.query}`,
        }),
      );
    }
  }
  return { proposed: results.length, ...summarize(results) };
}

/** N-grams actually present on a page. Good for seeding from existing content. */
export async function proposeFromPage(cloud, url, options = {}) {
  const minCount = options.minCount ?? 3;
  const parsed = await parseKeywords(url, { minCount });
  const results = [];
  const take = (pairs, kind) => {
    for (const [phrase, count] of pairs.slice(0, options.limit ?? 25)) {
      results.push(
        addTerm(cloud, phrase, {
          tool: "keywords",
          detail: `${url} (${kind}, ${count}x)`,
        }),
      );
    }
  };
  // Single words are usually too generic to track as ranking targets.
  take(parsed.pairs || [], "pair");
  take(parsed.triplets || [], "triplet");
  return { proposed: results.length, ...summarize(results) };
}

/**
 * What the pages currently ranking for a phrase are themselves about.
 *
 * Runs `ranked` for the phrase, then `keywords` over the top N results. This
 * is the most expensive proposer — one Google SERP plus N page loads — so it
 * throttles between pages.
 */
/**
 * Propose from the whole site rather than one page.
 *
 * Reading a single page is a bad sample and it shows: shantikava.com's
 * homepage is about 2,000 characters, so its n-grams surfaced "root beer" —
 * a real phrase from one menu item — with the same weight as "kava bar". The
 * page was read correctly; one thin page is just not evidence of what a site
 * is about.
 *
 * So this reads every page the site declares and aggregates before proposing.
 * A phrase earns a place by recurring **across pages**, which is what makes it
 * a theme rather than a detail. A phrase mentioned once on one page no longer
 * clears the bar, while one that appears on the menu, the about page and two
 * blog posts does.
 *
 * @param {object} cloud
 * @param {string} site a URL or bare hostname
 * @param {{minPages?: number, minTotal?: number, limit?: number,
 *   maxPages?: number, onProgress?: Function}} [options]
 */
export async function proposeFromSite(cloud, site, options = {}) {
  const {
    minPages = 2,
    minTotal = 4,
    limit = 60,
    maxPages = 40,
    onProgress = () => {},
  } = options;

  const discovered = await discoverPages(site, { limit: maxPages });
  if (!discovered.pages.length) {
    return {
      proposed: 0,
      pagesRead: 0,
      source: discovered.source,
      added: 0,
      known: 0,
      rejected: 0,
    };
  }

  /** phrase -> { total, pages:Set, n } */
  const tally = new Map();
  const failures = [];
  let pagesRead = 0;

  for (const [i, page] of discovered.pages.entries()) {
    onProgress(i + 1, discovered.pages.length, page.url);
    let parsed;
    try {
      parsed = await parseKeywords(page.url, { minCount: 1 });
    } catch (error) {
      // One unreachable page should not abandon the rest of the site.
      failures.push({ url: page.url, error: error.message });
      continue;
    }
    pagesRead++;

    const buckets = [
      [parsed.words, 1],
      [parsed.pairs, 2],
      [parsed.triplets, 3],
    ];
    for (const [rows, n] of buckets) {
      for (const [phrase, count] of rows || []) {
        const key = normalizePhrase(phrase);
        if (!key) continue;
        const entry = tally.get(key) || { total: 0, pages: new Set(), n };
        entry.total += count;
        entry.pages.add(page.url);
        tally.set(key, entry);
      }
    }
  }

  const ranked = rankSiteTally(
    [...tally.entries()].map(([phrase, e]) => ({
      phrase,
      n: e.n,
      total: e.total,
      pageCount: e.pages.size,
    })),
    pagesRead,
    { minPages, minTotal, limit },
  );

  const results = ranked.map((e) =>
    addTerm(cloud, e.phrase, {
      tool: "site",
      detail: `${e.pageCount} page(s), ${e.total}\u00d7 (${e.density.toFixed(1)}/page)`,
    }),
  );

  return {
    proposed: results.length,
    pagesRead,
    pagesFound: discovered.pages.length,
    pageUrls: discovered.pages.map((p) => p.url),
    source: discovered.source,
    sitemap: discovered.sitemap,
    failures,
    ...summarize(results),
  };
}

export async function proposeFromCompetitors(cloud, phrase, options = {}) {
  const topN = options.topN ?? 5;
  const ranking = await checkPhraseRanking(phrase, {
    ...options,
    target: null,
  });
  if (ranking.status !== "ranked" && ranking.status !== "not_in_results") {
    return {
      proposed: 0,
      added: 0,
      known: 0,
      rejected: 0,
      skipped: 0,
      ranking,
    };
  }
  // Reading the competitors' phrases is only half the job. The half that
  // turns a pile of n-grams into a worklist is diffing them against what your
  // own page already says — a phrase three competitors use and you do not is
  // a gap; one you already cover is noise.
  const diffAgainst = options.diffAgainst ?? cloud.target;
  let ownPhrases = null;
  if (diffAgainst && options.diffCoverage !== false) {
    try {
      const own = await parseKeywords(diffAgainst, { minCount: 1 });
      ownPhrases = new Set();
      for (const bucket of ["words", "pairs", "triplets"]) {
        for (const [p] of own[bucket] || []) ownPhrases.add(normalizePhrase(p));
      }
    } catch (e) {
      // Without our own page we can still propose, we just cannot call
      // anything a gap — say so rather than silently reporting zero gaps.
      ownPhrases = null;
      options.onWarn?.(`Could not read ${diffAgainst}: ${e.message}`);
    }
  }

  const results = [];
  const gapsByPhrase = new Map();
  const pages = (ranking.results || []).slice(0, topN);
  for (const [i, result] of pages.entries()) {
    if (i > 0) await sleep(options.delay ?? 2000);
    try {
      const parsed = await parseKeywords(result.url, {
        minCount: options.minCount ?? 3,
      });
      // Pairs as well as triplets: an exact 3-gram shared by two independent
      // sites is a very high bar, and 2-grams ("strobe beacon", "light bars")
      // are where the topical overlap actually shows up.
      const phrases = [
        ...(parsed.pairs || []).slice(0, 15),
        ...(parsed.triplets || []).slice(0, 15),
      ];
      for (const [p, count] of phrases) {
        const norm = normalizePhrase(p);
        results.push(
          addTerm(cloud, norm, {
            tool: "ranked+keywords",
            detail: `#${result.rank} ${result.url} (${count}x)`,
          }),
        );
        if (ownPhrases && !ownPhrases.has(norm)) {
          const gap = gapsByPhrase.get(norm) || {
            phrase: norm,
            forTarget: normalizePhrase(phrase),
            foundOn: [],
            comparedAgainst: diffAgainst,
            at: new Date().toISOString(),
          };
          if (!gap.foundOn.includes(result.url)) gap.foundOn.push(result.url);
          gapsByPhrase.set(norm, gap);
        }
      }
    } catch (e) {
      // A single unreachable competitor should not abort the proposal run.
      results.push({ outcome: "skipped", reason: e.message });
    }
  }

  // A phrase only ONE competitor uses is usually that site's own boilerplate —
  // shipping dates, breadcrumbs, marketplace furniture — not topical signal.
  // Requiring corroboration across competitors filters that out on principle
  // rather than by guessing at a blocklist of junk words.
  const minCompetitors = options.minCompetitors ?? 2;
  const all = [...gapsByPhrase.values()];
  const gaps = all
    .filter((g) => g.foundOn.length >= minCompetitors)
    .sort((a, b) => b.foundOn.length - a.foundOn.length);
  const uncorroborated = all.length - gaps.length;

  // Gaps enter as candidates automatically: candidates cost nothing and the
  // point of the loop is filling the list quickly. Promotion stays manual.
  cloud.gaps ||= [];
  for (const gap of gaps) {
    const existing = cloud.gaps.find(
      (g) => g.phrase === gap.phrase && g.forTarget === gap.forTarget,
    );
    if (existing) {
      existing.foundOn = [...new Set([...existing.foundOn, ...gap.foundOn])];
      existing.at = gap.at;
    } else {
      cloud.gaps.push(gap);
    }
  }

  return {
    proposed: results.length,
    ...summarize(results),
    pagesScanned: pages.length,
    gaps: gaps.length,
    // Distinguishes "no gaps found" from "could not check for gaps".
    gapsChecked: ownPhrases !== null,
    // Seen on only one competitor, so discarded as probable boilerplate.
    uncorroborated,
    minCompetitors,
    topGaps: gaps.slice(0, 10),
  };
}

/** Semantically related words via the free Datamuse API. */
export async function proposeFromRelated(cloud, seed, options = {}) {
  const rel = options.rel || "ml"; // ml = "means like"
  const words = await fetchDatamuseWords(encodeURIComponent(seed), rel);
  const results = (words || []).map((w) =>
    addTerm(cloud, w, { tool: "datamuse", detail: `${rel}: ${seed}` }),
  );
  return { proposed: results.length, ...summarize(results) };
}

/* ------------------------------------------------------------ measurement */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Check every core term's ranking for the cloud's target and append the
 * results to the cloud's history.
 */
export async function checkRankings(cloud, options = {}) {
  // The measurement itself, and its row in the database, belong to
  // services/measure.js — the job handlers take the same path. What stays here
  // is the cloud document's own copy, which is the curation view.
  const rows = await measureRankings(
    getTerms(cloud, STATUS.CORE).map((term) => term.phrase),
    {
      target: cloud.target,
      pages: options.pages,
      delayMs: options.delay ?? 5000,
      onProgress: options.onProgress,
    },
  );

  cloud.rankings.push(...rows);
  return rows;
}

/**
 * Is each core term actually present in the page's content?
 *
 * Matching happens in services/measure.js against the page's real text, so the
 * cloud and the job handlers agree. It used to read the n-gram index that
 * `keywords` builds, which is derived from a stopword-filtered word list and
 * therefore reported any multi-word phrase containing a stopword as absent.
 */
export async function checkCoverage(cloud, url, options = {}) {
  const pageUrl = url || cloud.target;
  if (!pageUrl) throw new Error("No URL given and the cloud has no target");

  const rows = await measureCoverage(
    pageUrl,
    getTerms(cloud, STATUS.CORE).map((term) => term.phrase),
    { onProgress: options.onProgress },
  );

  cloud.coverage.push(...rows);
  return rows;
}
