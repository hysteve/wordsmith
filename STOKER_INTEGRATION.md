# Stoker Integration — Brief

> Status: contract proposed, nothing built here yet. Written 2026-09-26.
> Wordsmith and Stoker are being developed in parallel, in separate sessions.
> This is what Wordsmith needs to know so it does not build the wrong seam.
> Full architecture: `stoker-platform/research/02-wordsmith-stoker-integration.md`.

## Who Stoker is

A content publishing platform (Next.js on Vercel), first proved out on
shantikava.com. Its loop is: **enter topics → generate → schedule → publish →
track performance.** It has no code yet; the contract is being fixed now so
both sides build toward it.

**Stoker is a consumer of Wordsmith. Wordsmith must never depend on Stoker.**
Wordsmith predates it, has CLI users, works against ultrabrightlightz.com
today, and may ship or sell on its own. Nothing in `packages/` should ever
import, name, or special-case Stoker.

## The division of labor

| | Wordsmith | Stoker |
|---|---|---|
| Owns | the **phrase** | the **artifact** |
| Verb | measures | produces |
| Truth | what the world does — SERPs, competitor pages, what is present on a URL | what we intend and what we shipped |

**The invariant:**

> **Wordsmith never writes content. Stoker never scrapes Google.**

If an article generator appears here, or a Puppeteer call appears in Stoker,
the boundary has moved and something is about to get duplicated. The existing
LM interface is *analysis of measurements* — audit summaries, clustering,
stemming for gap matching. That stays. Generation does not arrive.

## The seam already exists in this repo

`QUERIES_AND_KEYWORDS.md` ends the climb loop at step 6, "assign each utterance
to a content artifact," and notes that an utterance with no artifact is an
unstarted task. `loadCloud()` already backfills `term.assignments = []` and the
comment already says a head term is owned by a site rather than a URL.

**Stoker is the thing that writes to `assignments`.** That field is the entire
integration surface. Not a broad API — one small object.

Wordsmith needs to know only *whether a term is claimed*, so it can compute the
unassigned backlog. It must never learn what a Stoker artifact **is**. An opaque
ref plus a URL plus a status enum is exactly enough, and `artifactRef` is a
string this repo stores and returns without parsing.

> Doc drift to fix: `QUERIES_AND_KEYWORDS.md` still documents this as
> `assignedTo` (an object). The code now has `assignments` (a list), which
> resolves the open question at the bottom of that file. The docs should follow
> the code.

## Two channels, because the two halves have opposite runtime needs

**Channel A — pure logic, imported in-process.** `normalizePhrase`, `tokenize`,
`deriveRole`, `isQuestion`, `roleOf`, `contains`, `ancestorsOf`,
`descendantsOf`, `rollUp`, `findTerm`, `getTerms`, `getKeywords`, `getQueries`,
`buildReport`. No I/O, no network, no Chrome, milliseconds. Stoker calls these
directly and must **not** reimplement role derivation or the containment
lattice.

**Channel B — measurement, out-of-band.** `checkRankings`, `checkCoverage`, the
four proposers, the audit suite. These cannot sit on a Stoker request path, for
two independent reasons:

1. **Latency.** 20 core terms at a 5s jittered throttle is a couple of minutes,
   by design.
2. **IP reputation — the harder one.** Google throttles datacenter IPs far more
   aggressively than residential ones. `ranked` called from a Vercel function
   would return `blocked` almost immediately. Wordsmith runs where it can
   actually succeed — Steve's Mac, or a VPS — on a cron, and **pushes** results.

So Stoker never blocks on a scrape. Interactive research in its UI ("propose
keywords for this topic") is a **job**, not a call.

`packages/core/src/adapters/browser.js` made this split real: importing a
scraper module no longer spawns Chrome at module scope, so Channel A became
cheap to *run*. Making it cheap to *install* is the remaining job — see below.

## The two contracts

**Out — cloud snapshot** (`cloud export <name> [--out path]`, new subcommand):
the whole cloud document plus `schema: "wordsmith.cloud.snapshot/1"`,
`generatedAt`, and a `producer` block with the commit. Stoker consumes it as a
**committed JSON file** first — it diffs in review, works offline, and the first
one committed *is* the baseline. Clouds are still JSON under `WORDSMITH_DATA_DIR`,
and `loadCloud`/`saveCloud` remain the seam, so this can become an HTTP read or
a Turso table later without any consumer changing.

**In — assignments** (`cloud import-assignments <name> <file>`):

```jsonc
{ "schema": "stoker.assignments/1", "site": "shantikava",
  "assignments": [
    { "phrase": "is kava healthy for you",
      "artifactRef": "stoker:article/kava-guide",  // opaque here
      "url": "https://shantikava.com/kava-guide#is-kava-healthy",
      "artifact": "faq",        // page | section | faq | title
      "status": "planned" }     // planned | drafted | published
  ] }
```

**Single writer per field.** Stoker owns intent (`assignments`). Wordsmith owns
observation (`rankings`, `coverage`, `gaps`, `priority`). Nothing is written by
both, so the two stores cannot drift into conflict.

Both directions are needed because `checkCoverage()` proves a phrase is
**present**, not that it was **targeted**. The four-way diff between intent and
presence — written but didn't land / ranking by accident / needs more rungs /
**core term with no assignment = unstarted work** — is the product.

## Decisions already in flight that this affects

**The monorepo split** — in progress as of this writing: `@wordsmith/core`
(adapters, store, scrapers, audits, services) and `@wordsmith/worker` (HTTP API,
job runner, CLIs), pnpm workspace, TypeScript configured. The split by *process*
is right, and `core`'s `exports` map (`"./*": "./src/*"`) already makes subpath
imports work, which is most of what Channel A needed.

One thing it does **not** yet give Stoker. The A/B seam is not a package
boundary and shouldn't become one — it runs *through* one file:

    packages/core/src/services/cloud.js
      → scrapers/ranked.js → adapters/browser.js → browserless + puppeteer

The pure functions (`normalizePhrase`, `tokenize`, `deriveRole`, `contains`,
`ancestorsOf`, `rollUp`, `getKeywords`, `getQueries`, `buildReport`) live in the
same module as the proposers, so importing any of them drags Chrome into the
graph. `@wordsmith/core` depends on puppeteer, browserless, Lighthouse,
geoip-lite and whois-json — none of which belong in a Vercel function bundle.

**The ask, concretely:** split the file, not the package.

- `services/cloud-core.js` — pure: normalize, tokenize, role, lattice, views,
  report. No imports outside the module except Node builtins. Stoker imports
  only this.
- `services/cloud.js` — I/O: store, proposers, rankings, coverage. Imports
  `cloud-core.js` and the scrapers. Re-exports the pure surface so existing CLI
  callers don't change.

A cheap guard, once they're separate: a test that asserts `cloud-core.js` has no
relative imports. That keeps the seam from silently closing again.

Two smaller notes. `exports` maps `"."` to `./src/index.js`, which does not
exist yet — that entrypoint is the natural place to name the intended public
surface. And both packages are `"private": true`, so how Stoker consumes them is
still open: un-private them for a git dependency, or publish to a private
registry. **Stoker is not an `apps/*` entry in this workspace** — separate repo.
`apps/*` is for Wordsmith's own web UI.

**The web UI** — the real tension, worth settling before either UI is built.
Both products want a rankings chart. Split by **audience**, not by feature:

- **Wordsmith's UI is the instrument panel.** Single operator (Steve, or a
  future SEO customer): propose, promote, reject, ladder, gaps, rankings
  history, audits. Works standalone with no Stoker present. Curation lives
  here, which preserves the rule that nothing enters the core set silently.
- **Stoker's UI is the editorial surface.** The business owner (Shanti):
  backlog, drafts, schedule, publish, the content-vs-traffic timeline.

Same data, two renderings, one contract. If curation starts appearing in
Stoker, or a publish button appears here, revisit.

**Remaining duplication.** The split moved the two copies further apart rather
than merging them: `packages/worker/src/cli/ranked.js` still drives the browser
itself instead of calling `packages/core/src/scrapers/ranked.js` (same for
`keywords`). The new layout makes the rule obvious — `core` is the only
implementation, `worker` is a consumer of it exactly as Stoker is. Worth
finishing before a second consumer exists, or Stoker binds to the copy that
isn't maintained. Deleting `core-auditing.js` was the first half of this job.

## Preserve the honesty discipline across the boundary

This repo's hardest-won rules are that `blocked` is never inferred as
`not_in_results`, and that completion rank is labelled a popularity **proxy**
rather than volume. A dashboard makes every number look authoritative.

So the snapshot must carry the qualifier, not just the value. Anything exported
for the timeline gets `quality: measured | proxy | blocked | absent`, and
`priority` keeps its components rather than only the score, so a number can
always be explained. Stoker renders `blocked` as a gap in the line, never a
zero. This matters more, not less, once someone is paying for it.

## Asks of this repo, in order

1. Split `services/cloud.js` into `cloud-core.js` (pure) and `cloud.js` (I/O),
   so Stoker can import the lattice without importing Chrome. Unblocks Channel A.
2. Create the `shantikava` cloud and seed it: `propose-page` across the 8 real
   pages, `propose-competitors` against Green Turtle and Kafe Kava,
   `propose-completions` on local seeds.
3. Run `cloud rankings` and `cloud coverage` once against the **current** site
   and commit the export. This is the baseline — it needs no GA4, no Search
   Console, no owner access, and it is only capturable before the rebuild.
4. `cloud export` with the schema above.
5. `cloud import-assignments`, plus the `cloud queries --unassigned` view that
   `QUERIES_AND_KEYWORDS.md` already has on its checklist.

Steps 2 and 3 are the highest-value work available in either project right now,
and they have zero Stoker dependency.
