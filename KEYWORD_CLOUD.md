# Keyword Cloud

> Status: spec + working core module (`src/lib/queries/query-cloud.js`, CLI `src/scripts/cloud.js`).
> Written 2026-09-25, from a concept that had existed since June 2024 only as an
> empty file named `query-cloud.js` and six words in the README.

## The idea

A **keyword cloud** is a curated set of keywords and phrases that acts as the
source of truth for content production on a site.

- The **main set** is tracked deliberately, implemented in site content, and
  used to check rankings for specific phrases and show performance over time.
- **Research tools propose** additional phrases into the set. They do not add
  to it silently — a proposal is a candidate until it is promoted.

The distinction that makes this a workflow rather than a word list is the
term **status**:

| Status      | Meaning                                                                      |
| ----------- | ---------------------------------------------------------------------------- |
| `core`      | In the main set. Ranking-checked and coverage-checked on every run.          |
| `candidate` | Proposed by a tool or by hand. Never checked until promoted.                 |
| `rejected`  | Considered and declined. Kept so the same tool cannot re-propose it forever. |

Only `core` terms cost anything to track, so the set stays deliberate.

## Why this sits on top of tools that already work

Every input the concept needs already exists in this repo. The missing piece
was never research — it was **persistence**. Every tool here prints to stdout
and exits, so nothing is ever "tracked".

| Need                                   | Tool        | Module                               |
| -------------------------------------- | ----------- | ------------------------------------ |
| Related phrases people actually search | `googled`   | `api/googled/googled-module.js`      |
| Who currently ranks for a phrase       | `ranked`    | `api/ranked/ranked-module.js`        |
| Phrases present on a page (n-grams)    | `keywords`  | `api/keywords/keywords-module.js`    |
| Semantically related words             | Datamuse    | `lib/datamuse-api.js`                |
| Whether content implements a term      | audit suite | `audits/seo.js`, `audits/content.js` |

`syn` is deliberately not wired in: it currently returns `[]` because the
Thesaurus.com selectors are stale.

## Queries vs keywords

A `core` term can be a head phrase you want to _own_ (`kava saint augustine`)
or a complete utterance you want to _answer_ (`is kava healthy for you`). They
are the same object in different positions of the containment lattice, and the
position determines what you can do about it.

See [QUERIES_AND_KEYWORDS.md](QUERIES_AND_KEYWORDS.md) for that model and the
planned `role` / lattice / gap-diff additions. They extend this document rather
than introducing a second store.

## Data model

One JSON document per cloud, stored under `WORDSMITH_DATA_DIR` (default
`./data/clouds`). This follows the "local filesystem default, Postgres later"
plan in `followup-prompts.md`; every read and write goes through the store
functions so the backend can be swapped without touching the workflow logic.

```jsonc
{
  "name": "ultrabrightlightz",
  "target": "https://www.ultrabrightlightz.com",
  "created": "2026-09-25T...",
  "updated": "2026-09-25T...",
  "terms": [
    {
      "phrase": "emergency vehicle lighting", // normalized: lowercase, collapsed whitespace
      "status": "core",
      "sources": [
        // a phrase can be found several ways; all are kept
        {
          "tool": "keywords",
          "detail": "https://...  (triplet, 5x)",
          "at": "...",
        },
        { "tool": "googled", "detail": "seed: emergency vehicle", "at": "..." },
      ],
      "addedAt": "...",
      "promotedAt": "...",
      "notes": null,
    },
  ],
  "rankings": [
    // append-only history — this is the trend line
    {
      "phrase": "emergency vehicle lighting",
      "checkedAt": "...",
      "status": "ranked", // ranked | not_in_results | blocked | error
      "position": 4,
      "url": "https://...",
      "title": "...",
      "totalResults": 9,
    },
  ],
  "coverage": [
    // is the term actually implemented on the page?
    {
      "phrase": "emergency vehicle lighting",
      "pageUrl": "https://...",
      "checkedAt": "...",
      "occurrences": 5,
      "present": true,
    },
  ],
}
```

`rankings` is append-only on purpose. Unlike Google review data — which the
Places terms forbid warehousing — this is **your own measurement of a public
SERP**, so it can be stored and charted freely. It is the performance metric
the concept calls for.

## ⚠️ Google throttles consecutive requests

Measured while building this: `ranked` returns 9 results from a cold start and
**0 results** when it is the second Google request in quick succession. It
returns an empty array either way.

That means a naive loop over terms records "not ranking" for every term after
the first — a silent, confident falsehood of exactly the kind this codebase
has produced before.

Two mitigations, both in `checkRankings()`:

1. **Throttle.** A delay between requests, default 5s, configurable, with
   jitter. Checking 20 terms takes a couple of minutes; that is the correct
   speed.
2. **Never infer absence from emptiness.** Zero results for a real query is
   treated as `blocked`, not as `not_in_results`. A term is only recorded as
   `not_in_results` when the SERP came back populated and the target simply
   was not in it.

Anything that consumes `rankings` must therefore filter on
`status === "ranked" || status === "not_in_results"` and ignore `blocked`
rows rather than plotting them as zeroes.

## Workflow

```
   ┌── propose ──────────────────────────────────┐
   │  cloud propose-completions <seed>           │  googled
   │  cloud propose-page <url>                   │  keywords (n-grams)
   │  cloud propose-competitors <phrase>         │  ranked → keywords on each result
   │  cloud propose-related <seed>               │  Datamuse
   └─────────────────────────────────────────────┘
                      ↓ candidates
   ┌── curate ───────────────────────────────────┐
   │  cloud list --status candidate              │
   │  cloud promote <phrase>                     │
   │  cloud reject  <phrase>                     │
   └─────────────────────────────────────────────┘
                      ↓ core set
   ┌── measure ──────────────────────────────────┐
   │  cloud rankings   (throttled, per core term)│  ranked
   │  cloud coverage   (against target site)     │  keywords
   │  cloud report                               │
   └─────────────────────────────────────────────┘
```

## CLI

```bash
# create a cloud for a site
node src/scripts/cloud.js create ultrabrightlightz --target https://www.ultrabrightlightz.com

# seed it from the site's own content, then from live Google completions
node src/scripts/cloud.js propose-page ultrabrightlightz --url https://www.ultrabrightlightz.com
node src/scripts/cloud.js propose-completions ultrabrightlightz --seed "emergency vehicle lighting"

# see what turned up, promote the good ones
node src/scripts/cloud.js list ultrabrightlightz --status candidate
node src/scripts/cloud.js promote ultrabrightlightz "emergency vehicle lighting"

# two views over the one set: goals you want to own vs moves you can write
node src/scripts/cloud.js keywords ultrabrightlightz
node src/scripts/cloud.js queries ultrabrightlightz --questions
node src/scripts/cloud.js set-role ultrabrightlightz "some phrase" target

# what supports a goal, and what competitors say that your page does not
node src/scripts/cloud.js ladder ultrabrightlightz "light bars"
node src/scripts/cloud.js propose-competitors ultrabrightlightz --phrase "emergency vehicle light bars"
node src/scripts/cloud.js gaps ultrabrightlightz

# measure (throttled; --delay to tune)
node src/scripts/cloud.js rankings ultrabrightlightz --delay 6000
node src/scripts/cloud.js coverage ultrabrightlightz
node src/scripts/cloud.js report ultrabrightlightz
```

## Deliberately not built yet

- **Scheduling.** `rankings` is append-only and designed for repeat runs, but
  nothing schedules them. A cron calling `cloud rankings` is enough to start.
- **Postgres.** The store seam exists (`loadCloud`/`saveCloud`/`listClouds`);
  the Drizzle work in `followup-prompts.md` would slot in behind it.
- **Location targeting.** `ranked` and `googled` have no locale control, and
  completions observably skew to the caller's IP geography. Until that lands,
  rankings are "as seen from wherever this ran", which is recorded in
  `checkedAt` but not otherwise qualified.
- **Clustering.** Grouping terms into topics/intent is the natural next step
  and the point at which the LM interface earns its place.
- **`syn` integration**, pending the stale Thesaurus.com selectors.
