/**
 * Keyword Cloud — a tracked set of keywords that drives content production.
 *
 * See KEYWORD_CLOUD.md for the concept. In short: research tools *propose*
 * candidate phrases, a human *promotes* the good ones into the core set, and
 * only core terms get ranking- and coverage-checked over time.
 *
 * This module is the persistence and workflow layer over tools that already
 * work (googled, ranked, keywords, Datamuse). Storage is a JSON document per
 * cloud on the local filesystem; every access goes through loadCloud/saveCloud
 * so a Postgres backend can replace it without touching workflow logic.
 */

import fs from "fs/promises";
import path from "path";
import { extractQueryCompletions } from "../../api/googled/googled-module.js";
import { extractQueryRankings } from "../../api/ranked/ranked-module.js";
import { parseKeywords } from "../../api/keywords/keywords-module.js";
import { fetchDatamuseWords } from "../datamuse-api.js";

export const STATUS = Object.freeze({
  CORE: "core",
  CANDIDATE: "candidate",
  REJECTED: "rejected",
});

const DATA_DIR = () =>
  process.env.WORDSMITH_DATA_DIR || path.join(process.cwd(), "data", "clouds");

/** Phrases are compared normalized so the same term cannot enter twice. */
export function normalizePhrase(phrase) {
  return String(phrase || "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Role is a phrase's position in the containment lattice, and it decides what
 * you can actually do about it — see QUERIES_AND_KEYWORDS.md.
 *
 *   head      1-2 tokens   owned by the site. An outcome, never a task.
 *   target    3-4 tokens   owned by a page. Targeted directly.
 *   utterance 5+ tokens    a complete thing someone said. Written verbatim.
 *
 * Keywords (head/target) are goals; utterances are the moves that ladder up
 * to them. Derived from token count, which is a good default and a bad law —
 * `roleOverride` wins when set.
 */
export const ROLE = Object.freeze({
  HEAD: "head",
  TARGET: "target",
  UTTERANCE: "utterance",
});

const QUESTION_WORDS =
  /^(who|what|when|where|why|how|is|are|was|were|do|does|did|can|could|should|would|will|has|have|am)\b/;

export function tokenize(phrase) {
  return normalizePhrase(phrase).split(" ").filter(Boolean);
}

export function deriveRole(phrase) {
  const n = tokenize(phrase).length;
  if (n <= 2) return ROLE.HEAD;
  if (n <= 4) return ROLE.TARGET;
  return ROLE.UTTERANCE;
}

export function isQuestion(phrase) {
  const norm = normalizePhrase(phrase);
  return norm.endsWith("?") || QUESTION_WORDS.test(norm);
}

/** A term's effective role: manual override if set, otherwise derived. */
export function roleOf(term) {
  return term.roleOverride || term.role || deriveRole(term.phrase);
}

export function setRole(cloud, phrase, role) {
  if (role && !Object.values(ROLE).includes(role)) {
    throw new Error(
      `Unknown role "${role}". Use: ${Object.values(ROLE).join(", ")}`,
    );
  }
  const term = findTerm(cloud, phrase);
  if (!term) throw new Error(`Not in cloud: "${normalizePhrase(phrase)}"`);
  term.roleOverride = role || null; // null clears the override
  return term;
}

/* ---------------------------------------------------------------- lattice */

/**
 * Containment is by token *set*, not contiguous substring, so
 * "kava saint augustine" is correctly an ancestor of
 * "best kava bar in saint augustine" even though the tokens are not adjacent.
 */
export function contains(ancestorPhrase, descendantPhrase) {
  const a = new Set(tokenize(ancestorPhrase));
  const d = new Set(tokenize(descendantPhrase));
  if (a.size === 0 || a.size >= d.size) return false;
  for (const t of a) if (!d.has(t)) return false;
  return true;
}

/** Tracked terms whose tokens are a strict subset of this phrase. */
export function ancestorsOf(cloud, phrase) {
  return cloud.terms.filter((t) => contains(t.phrase, phrase));
}

/** Tracked terms whose tokens strictly contain this phrase. */
export function descendantsOf(cloud, phrase) {
  return cloud.terms.filter((t) => contains(phrase, t.phrase));
}

/**
 * How much of a goal is actually supported by tracked, ranking descendants.
 *
 * A head term with no tracked descendants is a wish, not a plan, and this is
 * what lets the tool say so rather than leaving it an ambition.
 */
export function rollUp(cloud, phrase) {
  const latest = new Map();
  for (const r of cloud.rankings) {
    if (r.status !== "ranked" && r.status !== "not_in_results") continue;
    const prev = latest.get(r.phrase);
    if (!prev || r.checkedAt > prev.checkedAt) latest.set(r.phrase, r);
  }
  const descendants = descendantsOf(cloud, phrase);
  const ranked = descendants.filter((t) => latest.get(t.phrase)?.position);
  const own = latest.get(normalizePhrase(phrase));
  return {
    phrase: normalizePhrase(phrase),
    position: own?.position ?? null,
    descendants: descendants.length,
    descendantsRanked: ranked.length,
    descendantsCore: descendants.filter((t) => t.status === STATUS.CORE).length,
    bestDescendant:
      ranked
        .map((t) => latest.get(t.phrase))
        .sort((a, b) => a.position - b.position)[0] ?? null,
  };
}

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

/* ------------------------------------------------------------------ terms */

export function findTerm(cloud, phrase) {
  const norm = normalizePhrase(phrase);
  return cloud.terms.find((t) => t.phrase === norm) || null;
}

export function getTerms(cloud, status, role) {
  return cloud.terms.filter(
    (t) => (!status || t.status === status) && (!role || roleOf(t) === role),
  );
}

/** Keyword view: goals — phrases you want to own but cannot write verbatim. */
export function getKeywords(cloud, status) {
  return cloud.terms.filter(
    (t) =>
      (!status || t.status === status) &&
      (roleOf(t) === ROLE.HEAD || roleOf(t) === ROLE.TARGET),
  );
}

/** Query view: moves — complete utterances, each addressable by one passage. */
export function getQueries(cloud, status) {
  return getTerms(cloud, status, ROLE.UTTERANCE);
}

/**
 * Add a phrase, or record an additional source for one already present.
 *
 * Returns what happened so callers can report "12 new, 30 already known"
 * rather than implying every proposal was a discovery.
 */
export function addTerm(cloud, phrase, { status, tool, detail } = {}) {
  const norm = normalizePhrase(phrase);
  if (!norm) return { outcome: "skipped", reason: "empty phrase" };

  const source = {
    tool: tool || "manual",
    detail: detail || null,
    at: new Date().toISOString(),
  };
  const existing = findTerm(cloud, norm);
  if (existing) {
    // Never resurrect a rejected term by proposing it again, but do record
    // that another tool found it — that is useful signal when reviewing.
    const known = existing.sources.some(
      (s) => s.tool === source.tool && s.detail === source.detail,
    );
    if (!known) existing.sources.push(source);
    return {
      outcome: existing.status === STATUS.REJECTED ? "rejected" : "known",
      term: existing,
    };
  }

  const term = {
    phrase: norm,
    status: status || STATUS.CANDIDATE,
    // Intrinsic and immutable for a given phrase; stored so the JSON document
    // is inspectable without re-deriving. `role` is a cached default —
    // roleOf() still wins with roleOverride.
    tokens: tokenize(norm).length,
    isQuestion: isQuestion(norm),
    role: deriveRole(norm),
    roleOverride: null,
    sources: [source],
    // A head term is owned by a site rather than a URL, so assignments is a
    // list for every role; an utterance normally has exactly one.
    assignments: [],
    addedAt: source.at,
    promotedAt: status === STATUS.CORE ? source.at : null,
    notes: null,
  };
  cloud.terms.push(term);
  return { outcome: "added", term };
}

export function promoteTerm(cloud, phrase) {
  const term = findTerm(cloud, phrase);
  if (!term) throw new Error(`Not in cloud: "${normalizePhrase(phrase)}"`);
  term.status = STATUS.CORE;
  term.promotedAt = new Date().toISOString();
  return term;
}

export function rejectTerm(cloud, phrase) {
  const term = findTerm(cloud, phrase);
  if (!term) throw new Error(`Not in cloud: "${normalizePhrase(phrase)}"`);
  term.status = STATUS.REJECTED;
  return term;
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
 * Rank a single phrase, distinguishing "not ranking" from "we got blocked".
 *
 * Google throttles consecutive requests and `ranked` returns an empty array
 * either way. Recording that as position-not-found would be a silent, false
 * measurement, so an empty SERP is reported as `blocked` and only a populated
 * SERP that lacks the target counts as `not_in_results`.
 */
export async function checkPhraseRanking(phrase, options = {}) {
  const { target } = options;
  let results;
  try {
    results = await extractQueryRankings(phrase, {
      pages: options.pages ?? 1,
      exclude: [],
      screenshot: false,
    });
  } catch (e) {
    return { phrase, status: "error", reason: e.message, results: [] };
  }

  if (!results || results.length === 0) {
    return {
      phrase,
      status: "blocked",
      reason:
        "Google returned an empty result set. This is usually throttling of consecutive requests, not an absence of results — increase --delay.",
      results: [],
    };
  }

  if (!target)
    return { phrase, status: "ranked", results, totalResults: results.length };

  const host = (u) => {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  };
  const targetHost = host(
    target.startsWith("http") ? target : `https://${target}`,
  );
  const hit = results.find((r) => host(r.url) === targetHost);

  return hit
    ? {
        phrase,
        status: "ranked",
        position: hit.rank,
        url: hit.url,
        title: hit.title,
        totalResults: results.length,
        results,
      }
    : {
        phrase,
        status: "not_in_results",
        totalResults: results.length,
        results,
      };
}

/**
 * Check every core term's ranking for the cloud's target and append the
 * results to the cloud's history.
 */
export async function checkRankings(cloud, options = {}) {
  const delay = options.delay ?? 5000;
  const core = getTerms(cloud, STATUS.CORE);
  const checkedAt = new Date().toISOString();
  const rows = [];

  for (const [i, term] of core.entries()) {
    if (i > 0) {
      // Jitter so repeat runs do not form a perfectly regular pattern.
      await sleep(delay + Math.floor(Math.random() * 1000));
    }
    if (options.onProgress) options.onProgress(i + 1, core.length, term.phrase);
    const r = await checkPhraseRanking(term.phrase, {
      target: cloud.target,
      pages: options.pages,
    });
    const row = {
      phrase: term.phrase,
      checkedAt,
      status: r.status,
      position: r.position ?? null,
      url: r.url ?? null,
      title: r.title ?? null,
      totalResults: r.totalResults ?? 0,
      reason: r.reason ?? null,
    };
    cloud.rankings.push(row);
    rows.push(row);
  }
  return rows;
}

/**
 * Is each core term actually implemented in the page's content?
 *
 * Uses the same n-gram extraction as `keywords`, with minCount 1 so a term
 * that appears even once registers as present.
 */
export async function checkCoverage(cloud, url, options = {}) {
  const pageUrl = url || cloud.target;
  if (!pageUrl) throw new Error("No URL given and the cloud has no target");
  const parsed = await parseKeywords(pageUrl, { minCount: 1 });
  const counts = new Map();
  for (const bucket of ["words", "pairs", "triplets"]) {
    for (const [phrase, count] of parsed[bucket] || []) {
      counts.set(normalizePhrase(phrase), count);
    }
  }
  const checkedAt = new Date().toISOString();
  const rows = getTerms(cloud, STATUS.CORE).map((term) => {
    const occurrences = counts.get(term.phrase) || 0;
    return {
      phrase: term.phrase,
      pageUrl,
      checkedAt,
      occurrences,
      present: occurrences > 0,
    };
  });
  cloud.coverage.push(...rows);
  return rows;
}

/* ---------------------------------------------------------------- reporting */

/** Latest ranking and coverage per core term, plus movement since last check. */
export function buildReport(cloud) {
  const latestBy = (rows, key) => {
    const map = new Map();
    for (const r of rows) {
      const prev = map.get(r[key]);
      if (!prev || r.checkedAt > prev.checkedAt) map.set(r[key], r);
    }
    return map;
  };
  // Only measured rows belong in a trend; `blocked` rows are absence of data.
  const measured = cloud.rankings.filter(
    (r) => r.status === "ranked" || r.status === "not_in_results",
  );
  const latestRank = latestBy(measured, "phrase");
  const latestCov = latestBy(cloud.coverage, "phrase");

  const rows = getTerms(cloud, STATUS.CORE).map((term) => {
    const history = measured
      .filter((r) => r.phrase === term.phrase)
      .sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));
    const current = latestRank.get(term.phrase) || null;
    const previous = history.length > 1 ? history[history.length - 2] : null;
    const delta =
      current?.position && previous?.position
        ? previous.position - current.position // positive = improved
        : null;
    const cov = latestCov.get(term.phrase) || null;
    return {
      phrase: term.phrase,
      position: current?.position ?? null,
      rankStatus: current?.status ?? "unchecked",
      delta,
      checkedAt: current?.checkedAt ?? null,
      onPage: cov ? cov.present : null,
      occurrences: cov ? cov.occurrences : null,
      dataPoints: history.length,
    };
  });

  return {
    cloud: cloud.name,
    target: cloud.target,
    counts: {
      core: getTerms(cloud, STATUS.CORE).length,
      candidate: getTerms(cloud, STATUS.CANDIDATE).length,
      rejected: getTerms(cloud, STATUS.REJECTED).length,
    },
    blockedChecks: cloud.rankings.filter((r) => r.status === "blocked").length,
    rows,
  };
}
