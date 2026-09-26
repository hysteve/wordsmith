/**
 * Keyword Cloud — the pure part: phrase normalization, the role ladder, the
 * containment lattice, and the views and report built on top of them.
 *
 * This file must never import anything but Node builtins. It is split out of
 * cloud.js so a consumer can reason about a cloud document without pulling in
 * the scrapers, and through them browserless, puppeteer, Lighthouse and
 * geoip-lite — none of which belong in a serverless bundle. cloud-core.test.js
 * asserts the no-imports rule, so the seam cannot quietly close again.
 *
 * See KEYWORD_CLOUD.md for the concept and QUERIES_AND_KEYWORDS.md for the
 * query/keyword distinction these roles encode.
 */

export const STATUS = Object.freeze({
  CORE: "core",
  CANDIDATE: "candidate",
  REJECTED: "rejected",
});

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

/* --------------------------------------------------------------- matching */

/**
 * Page text, flattened for comparison: lowercase, straight quotes, single
 * spaces. Punctuation is kept so that word boundaries still mean something.
 */
export function normalizeForMatch(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ");
}

/**
 * How many times a phrase literally appears in a page's text.
 *
 * Coverage used to be answered from the n-gram index that `keywords` builds,
 * but that index is constructed from a stopword-filtered word list — on
 * example.com, "in illustrative examples" becomes the pair
 * "documentation examples". Those n-grams are not substrings of the page, so
 * any multi-word phrase containing a stopword was reported absent when it was
 * plainly there. Coverage is a claim about presence, so it has to read the
 * actual text.
 */
export function countOccurrences(text, phrase) {
  const haystack = normalizeForMatch(text);
  const needle = normalizePhrase(phrase);
  if (!needle || !haystack) return 0;

  const isWordChar = (ch) => /[a-z0-9]/.test(ch || "");
  let count = 0;
  let index = 0;

  while ((index = haystack.indexOf(needle, index)) !== -1) {
    // Only count whole-word hits, so "cat" does not match "category".
    const before = index === 0 ? "" : haystack[index - 1];
    const after = haystack[index + needle.length] ?? "";
    if (!isWordChar(before) && !isWordChar(after)) count++;
    index += needle.length;
  }
  return count;
}

/* ------------------------------------------------------- site-wide ranking */

/**
 * Decide which phrases from a whole-site tally are worth proposing.
 *
 * Reading one page is a bad sample: shantikava.com's homepage is about 2,000
 * characters, so its n-grams offered "root beer" — real text from one menu
 * item — beside "kava bar". Aggregating across pages fixes that and creates
 * the opposite problem, because the navigation and footer appear on *every*
 * page and would win on ubiquity alone.
 *
 * The discriminator is **density**. Chrome appears about once per page because
 * it is one nav link; a subject gets repeated on the pages that are about it.
 * On that site "kava" is 85 hits over 14 pages (~6 per page) and stays, while
 * "menu contact" is 14 over 14 (~1 per page) and goes, along with the footer
 * phone number.
 *
 * @param {Array<{phrase: string, n: number, total: number, pageCount: number}>} tally
 * @param {number} pagesRead
 * @returns {Array<{phrase: string, n: number, total: number, pageCount: number,
 *   ubiquity: number, density: number, score: number}>} ranked, best first
 */
export function rankSiteTally(tally, pagesRead, options = {}) {
  const {
    minPages = 2,
    minTotal = 4,
    limit = 60,
    ubiquityCutoff = 0.8,
    chromeDensity = 2,
  } = options;

  return tally
    .map((e) => {
      const ubiquity = pagesRead ? e.pageCount / pagesRead : 0;
      const density = e.pageCount ? e.total / e.pageCount : 0;
      return {
        ...e,
        ubiquity,
        density,
        // Reward being *used*, and being used in more than one place.
        score: density * Math.log2(1 + e.pageCount),
      };
    })
    .filter((e) => {
      // A phone number fragment is not a keyword.
      if (!/[a-z]/i.test(e.phrase)) return false;
      // On nearly every page and said only once there: chrome.
      if (e.ubiquity > ubiquityCutoff && e.density < chromeDensity)
        return false;
      // Single words are vocabulary more often than phrases, so they pay more.
      return e.n === 1
        ? e.pageCount >= Math.max(minPages, 3) && e.total >= minTotal * 2
        : e.pageCount >= minPages || e.total >= minTotal;
    })
    .sort((a, b) => b.score - a.score || b.total - a.total)
    .slice(0, limit);
}
