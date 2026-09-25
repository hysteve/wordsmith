# Queries and Keywords

> Design note. Captures the conceptual model behind query tracking and how it
> relates to [KEYWORD_CLOUD.md](KEYWORD_CLOUD.md). Written 2026-09-25 from a
> working-out-loud session; the distinction had not been recorded anywhere.

## The distinction

"Query" and "keyword" are not two kinds of object. They are the **same
object** — a phrase someone typed into a search engine — playing two different
roles depending on **where the phrase sits in the containment lattice**.

That position determines the only thing that actually matters operationally:
**what you can do about it.**

| Tokens | Example                   | Addressable by           | How you win it                                     |
| ------ | ------------------------- | ------------------------ | -------------------------------------------------- |
| 1–2    | `kava`                    | the site / the brand     | accumulated authority. An _outcome_, never a task. |
| 2–4    | `kava saint augustine`    | a page or category       | on-page targeting, plus descendant wins rolling up |
| 5+     | `is kava healthy for you` | a passage, FAQ entry, H2 | write one thing that answers it                    |

**Keywords are goals. Queries are moves.**

A keyword is what you want to be known for. A query is what someone actually
asked. You cannot _do_ a keyword — there is no action called "rank for kava".
You can only do queries that ladder up to it.

This is why dominance shows up as ranking on _short_ phrases. Short phrases are
the emergent result of many specific wins, not an input you can attack directly.

### The test

Ask: **can I write this verbatim into content?**

- `is kava healthy for you` → yes. It is an FAQ question, an H2, an article
  title. One passage wins it. → **query / move**
- `kava saint augustine` → no. You'd write "Kava in Saint Augustine" — that's a
  _rendering_ of the phrase, not the phrase. It names a page's topic rather
  than saying anything. → **keyword / goal**

A phrase that can be spoken is a move. A phrase that can only be _about_
something is a goal.

### Why the granularities line up

The lattice mirrors the content hierarchy, which is what makes the model
useful rather than merely tidy:

```
site        kava                              ← goal, measured, never written
  └ page      kava saint augustine            ← goal, targeted, partly written
      └ passage  is kava healthy for you      ← move, written verbatim
      └ passage  how much kava is too much
      └ passage  does kava show on a drug test
```

Winning three passages lifts the page. Winning pages lifts the site. That is
the feedback up the chain — and it means **the unit of work is always a leaf**,
no matter how head-y the goal.

## One substrate, two views

The instinct is to build query tracking as a separate feature beside the
keyword cloud. **Recommendation: don't.** They are the same store with
different lenses.

Both are: a normalized phrase, a status, a set of discovery sources, a ranking
history, and a coverage record. The keyword cloud already models all of that.
Splitting them means two stores that drift, two ranking checkers, two
throttles — which is the same duplication disease already in this repo
(`ranked.js` vs `ranked-module.js`, `keywords.js` vs `keywords-module.js`,
where `parse()` is copy-pasted verbatim and the two copies have already
diverged).

Instead: **keep one `terms` collection and derive the role.**

```js
role(phrase) =>
  tokens <= 2                 ? "head"      // goal, site-level
  : tokens <= 4               ? "target"    // goal, page-level
  : "utterance"                             // move, passage-level
```

Derived, with a manual override — because the heuristic is a good default and a
bad law. `best kava bar near me open now` is 7 tokens but behaves like a
target, and `kava` alone might be an utterance for a brand named Kava.

The two views are then just filters:

- **Keyword cloud view** — head + target terms. "What do we want to own?"
- **Query tracker view** — utterances. "What are we answering, and where is
  each one implemented?"

## The lattice

Compute containment from token sets. It is cheap — no API, no model — and it is
what makes "feeds back up the chain" mechanical rather than vibes.

```
ancestors("is kava healthy for you")  → ["kava", "kava healthy"]
descendants("kava")                   → every tracked phrase containing "kava"
```

Two things fall out of it immediately:

1. **Roll-up.** A head term's realistic prospects are a function of how many of
   its descendants you already rank for. A head term with zero tracked
   descendants is a wish, not a plan — and the model can say so out loud
   instead of leaving it as a vague ambition.
2. **Ladder proposals.** For a head term you want and don't have, the useful
   suggestion is not "try harder" — it's "here are utterances containing it
   that you are not yet tracking", straight out of query completions.

## Prioritization without paid volume data

Prioritizing queries properly wants search volume and difficulty. Both are paid
(Ahrefs, Semrush, DataForSEO). Rather than pretend, **proxy them and label the
proxies as proxies** — the same discipline as the `blocked` vs `not_in_results`
distinction in the ranking checker.

Honest proxies available from tools already in this repo:

| Signal       | Proxy                                                                          | Source              |
| ------------ | ------------------------------------------------------------------------------ | ------------------- |
| Popularity   | position in Google's completion list — Google orders completions by popularity | `googled`           |
| Popularity   | how many distinct seeds a phrase surfaces under                                | `googled` cascade   |
| Breadth      | token count (inverse)                                                          | local               |
| Difficulty   | how many top-10 results are major domains                                      | `ranked`            |
| Opportunity  | competitors rank, you don't                                                    | `ranked` + coverage |
| Reachability | your current position, if any                                                  | ranking history     |

A composite priority score built from these is directionally useful and costs
nothing. It must never be presented as volume. Store the components, not just
the total, so a number can always be explained.

## The climb loop

The workflow described for climbing any ranking, made concrete:

```
1. pick a target you rank poorly for
2. ranked <phrase>                     → who is above you
3. keywords <each top result>          → what those pages are actually about
4. diff against your own coverage      → phrases they have that you lack
5. propose the gaps as candidates      → promote the ones worth writing
6. assign each utterance to a content artifact
7. re-check rankings on a schedule     → did the ladder lift the parent?
```

Steps 2–5 are implemented. `proposeFromCompetitors()` reads your own target
page once, then marks any competitor phrase absent from it as a gap.

### Gaps need corroboration, not a blocklist

The first live run produced this, from the top 2 results for
"emergency vehicle light bars":

```
1 × get it as          1 × wednesday sep 30     1 × free shipping by
1 × soon as wednesday  1 × sep 30 free          1 × clothing shoes jewelry
1 × rooftop strobe beacon   1 × led rooftop strobe   1 × strobe beacon lights
```

Three of nine are topical. The rest is Amazon furniture — shipping dates and
category breadcrumbs — because one of the ranking pages was a marketplace
listing.

The fix is not a blocklist of junk words, which is unwinnable whack-a-mole. It
is **corroboration**: a phrase one competitor uses is that site's own
boilerplate; a phrase several independent sites share is topical. Gaps now
require `minCompetitors` (default 2) and the scan reads 2-grams as well as
3-grams, since exact trigram overlap between independent sites is a very high
bar and the topical overlap shows up in pairs.

**Honest result:** across 5 competitors for that phrase, _nothing_ corroborated
— 28 phrases each appeared on exactly one page. The tool says so rather than
reporting "no gaps, you're covered", which is a different claim. Exact-phrase
matching is the limiting factor; stemming or embedding-based matching is the
next real improvement, and is a reasonable first job for the LM interface.

Step 6 is the bridge to content production, and the reason utterances matter:
an utterance with no assigned artifact is an unstarted task, and that is a far
more actionable backlog than a list of words.

## Data model additions

Extends the cloud document in [KEYWORD_CLOUD.md](KEYWORD_CLOUD.md); no new
store.

```jsonc
{
  "terms": [
    {
      "phrase": "is kava healthy for you",
      "status": "core",
      "role": "utterance", // derived from token count
      "roleOverride": null, // manual override when the heuristic is wrong
      "tokens": 5,
      "isQuestion": true, // leading interrogative or trailing "?"
      "priority": {
        "score": 0.62,
        "completionRank": 3, // 3rd completion Google offered — popularity proxy
        "seedCount": 2, // surfaced under 2 distinct seeds
        "serpAuthority": 0.8, // share of top-10 held by major domains
        "computedAt": "...",
      },
      "assignedTo": {
        // utterances only; the content bridge
        "url": "https://.../kava-guide#is-kava-healthy",
        "artifact": "faq", // page | section | faq | title
        "status": "published", // planned | drafted | published
      },
      "ancestors": ["kava", "kava healthy"], // derived, cached
    },
  ],
  "gaps": [
    // from the climb loop, step 4
    {
      "phrase": "kava kava root effects",
      "foundOn": ["https://competitor.com/kava-101"],
      "forTarget": "kava saint augustine",
      "youRank": null,
      "at": "...",
    },
  ],
}
```

## Build status

- [x] **`role` + `tokens` + `isQuestion`** on terms, derived with override
      (`cloud set-role`). Backfilled onto documents written before it existed.
- [x] **Lattice helpers** — `contains()`, `ancestorsOf()`, `descendantsOf()`,
      `rollUp()`, surfaced as `cloud ladder`. Containment is by token _set_, so
      `kava saint augustine` is correctly an ancestor of
      `best kava bar in saint augustine` despite the tokens not being adjacent.
- [x] **Coverage diff** in `proposeFromCompetitors()`, with corroboration —
      `cloud gaps`.
- [x] **Views** — `cloud keywords` (goals) and `cloud queries` (moves,
      `--questions` to filter to question-form) over the one store.
- [ ] **Priority scoring** from the proxy table, components stored.
- [ ] **`assignments`** plus a `cloud queries --unassigned` view. The field
      exists on every term (a list, since a head term is owned by a site rather
      than a URL); nothing writes to it yet.

### Observed while building

The proposers map onto roles, which was not obvious up front and is worth
knowing when seeding a cloud:

| Proposer                        | Produces                              | Role                      |
| ------------------------------- | ------------------------------------- | ------------------------- |
| `propose-page` (n-grams)        | 2–3 token fragments                   | head / target — **goals** |
| `propose-related` (Datamuse)    | single words                          | head                      |
| `propose-completions` (googled) | 6–8 token utterances, often questions | utterance — **moves**     |

So a cloud seeded only from page n-grams will contain no utterances at all —
no moves, only goals. Completions are what fill the content backlog.

Deliberately deferred: paid volume/difficulty APIs; intent classification
beyond `isQuestion` (a reasonable first use of the LM interface, once there is
enough data to make it worth the call); locale-aware ranking, which is blocked
on `ranked`/`googled` having no location control at all.

## Open questions

- **When does a gap become a term?** Automatically as a candidate, or only on
  explicit promotion? Leaning automatic-as-candidate, since candidates are free
  and the whole point is filling the list quickly.
- **Do rejected utterances suppress their ancestors?** Probably not — rejecting
  one phrasing of a question says nothing about the topic.
- **Multi-page targets.** A head term is owned by a site, not a URL, so
  `assignedTo` may need to be a list for `target`-role terms.
