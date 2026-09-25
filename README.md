# Wordsmith

> Tools for smithing with words

## Install scripts

- run `npm run install-scripts` to install `googled` and `syn`.

> Note: you may need to run `sudo chmod -R 755 ./output`, `sudo chmod +x src/googled.js`, and `sudo chmod +x src/syn.js`.

## Syn - Get synonyms for a word from Thesaurus.com

Uses browserless and a custom scraper to pull out synonyms for a given word. You can specify if you want only the noun, verb, adjective synonyms or only want stronger matches.

This is based on the current html structure and could break anytime Thesaurus.com changes their site.
Written 6/10/2024, 12:49:15 PM.

```bash
syn redemption -w noun -s 3 --pretty

url: https://www.thesaurus.com/browse/redemption


Synonyms
[noun]
amends, shrift, penance, redress, atonement, expiation, recompense, reparation, repentance, restitution, compensation

[noun]
grace, salvation, deliverance


Related Words
[noun]
buy, gain, prize, gaining, pursuit, salvage, winning, addition, learning, property, purchase, recovery, accretion, acquiring, procuring, retrieval, attainment, obtainment, possession, redemption, achievement, acquirement, procuration, procurement, acquisitions

[noun]
amends, payment, penance, redress, atonement, expiation, recompense, redemption, reparation, restitution, propitiation, satisfaction, indemnification

[noun]
rescue, saving, freeing, release, delivery, acquittal, salvation, redemption, deliverance, extrication, emancipation

[noun]
love, grace, favor, lenity, pardon, caritas, charity, quarter, clemency, goodness, kindness, leniency, reprieve, good will, compassion, generosity, indulgence, kindliness, redemption, tenderness, benefaction, beneficence, benevolence, forbearance, responsiveness, compassionateness

[noun]
grace, purge, laving, baptism, bathing, rebirth, washing, ablution, lavation, atonement, catharsis, expiation, purgation, purifying, salvation, lustration, absolution, depuration, redemption, refinement, expurgation, forgiveness, rarefaction, disinfection, distillation, regeneration, sanctification
```

### Features

- `-w, --wordType`: noun, verb, adjective, etc
- `-s, --strength`: 1, 2, or 3, higher = stronger
- `-a, --allWords`: Just print the words in an array

## Googled (Google Query Expander) - get live search completions for a search phrase from Google

Uses browserless and a custom scraper to type a search query into google and pull the resulting search completions out into a text result. Useful for compiling search queries to optimize a webpage for, to check rankings for (possible upcoming tool), and for using brand keywords to find related search ternms that you can experiment with ranking in.

### Features

- `"-c, --cascade"` - Cascade search - Splits the initial phrase into parts, and incrementally adds the terms, capturing results at each new word addition
- Adjust pause - there is a pause after entering search terms to allow the completions to populate; configure it with `"-d"`
- Pretty-print by default, output json with `"-j"`
- Take a screenshot with `"-s"`

> Note: This is an alpha version, please report bugs and improvement ideas

```bash
googled "good dog parks" -c

Google Completions for: "good dog parks"
Query: "good dog"
names, food, food brands, carl, foundation, pet training, breeds, names for boys
Query: "good dog parks"
near me, in sydney, san antonio, las vegas, chicago, atlanta, toronto, best
```

Future improvements:

- Swap Terms - Search for multiple alternate terms for a cascaded search

## Ranked - Google Query Rankings - get the top ranking sites for a specific search query in Google

Pass in a query, get rankings. That simple. That powerful.

```bash
ranked "get lit lighting"

Top 10 results for "get lit lighting"
1. https://getlitledlighting.com/
	Get Lit LED Lighting
2. https://www.getliteventlighting.com/
	Get Lit Event Lighting
3. https://www.getlitltd.com/
	Get Lit, LTD. - designer lighting for the wholesale trade
...
```

...But there's more!

You can also get _backlinks_ easily using `ranked -l <url>`.

```bash
ranked -l "https://ultrabrightlightz.com" -x http://www.tiktok.com
Top 10 sites that link back to "https://ultrabrightlightz.com" (excluding http://www.tiktok.com)
1. https://www.linkedin.com/company/ultra-bright-lightz
	Ultra Bright Lightz - LinkedIn
2. https://www.facebook.com/ultrabrightlightz/videos/z-flash-plug-n-play-module/724355079165169/
	Z-Flash Plug-N-Play Module | factory | By Ultra Bright LightzFacebook
3. https://m.facebook.com/ultrabrightlightz/posts/6475129259184385/
	Ultra Bright Lightz's post - Facebook
...
```

For features, do `ranked -h`.

## Keywords - grab and analyze meaningful keywords from any webpage

`-m, --minCount` only returns keywords that occur N or greater times on the page.

```bash
keywords https://ultrabrightlightz.com/ -m 4

Keywords for https://ultrabrightlightz.com/
Word counts: [
  [ 'lights', 52 ],    [ 'emergency', 22 ],
  [ 'vehicle', 19 ],   [ 'warning', 19 ],
  [ 'led', 17 ],       [ 'light', 16 ],
  [ 'bars', 16 ],      [ 'bright', 15 ],
  [ 'ultra', 13 ],     [ 'lightz', 13 ],
  ...
]
Word pairs: [
  [ 'warning lights', 17 ],
  [ 'light bars', 15 ],
  [ 'ultra bright', 13 ],
  ...
]
Word triplets: [
  [ 'ultra bright lightz', 13 ],
  [ 'emergency vehicle lighting', 5 ],
  [ 'vehicle lighting equipment', 5 ],
  ...
]
```

For features, do `keywords -h`.

## Domain - check if a domain is available

```bash
domain iwannalovejah.com
{ available: true }
```

```bash
domain xmen.com
{ available: false }
```

## DomainS - provide available suggstions for a domain

This is very beta and highly weird, needs some mcluvin, but still interesting and useful for producing decent available domain names.

```bash
domains lactose.com
? Select categories to use for domain generation: default, character,
formal_group, formal_gathering, value_adjective, value_adverb, time, innovation,
 positive, success
Generated Domain Ideas: [] [] []
Unavailable: lactose.com
Available Variations:
  1. crewlactosefast.com
  2. lactose.guide
  3. lactosepoint.com
  4. rallylactose.org
  5. clearlactose.guide
  6. lactoseconclave.com
  7. getlactose.com
  8. futurelactose.com
  9. saintlactose.com
  10. lactosesummit.com
Domain checking complete.
```

## Cloud - track a keyword cloud

A **keyword cloud** is a curated set of phrases that drives content production:
research tools propose candidates, you promote the good ones into the core set,
and only core terms get ranking- and coverage-checked over time.

```bash
cloud create mysite --target https://mysite.com
cloud propose-page mysite                      # n-grams from your own content
cloud propose-completions mysite --seed "..."  # live Google completions
cloud list mysite --status candidate
cloud promote mysite "some phrase"
cloud rankings mysite                          # throttled; tracks position over time
cloud coverage mysite                          # is the term actually on the page?
cloud report mysite
```

See [KEYWORD_CLOUD.md](KEYWORD_CLOUD.md) for the data model and the Google
throttling caveat.

## Future Tools

Feature updates:

- Ranked & Googled
  - Allow setting location for searches
  - Backup results to db
  - Pull more values - title, url path, meta tags, aria-tags, images, labels
  - Perform lighthouse test on any site
  - Save search data to local db or local files, create cli for navigating data and using it as input for additional functions
- Perform keyword extractions on ranked pages, check for ranked search query inclusion

- Brand Pilot - create, extract, tweak, and analyze a brand web presence
  - https://github.com/puppeteer/puppeteer/blob/ddc59b247282774ccc53e3cc925efc30d4e25675/docs/api.md#pageexposefunctionname-puppeteerfunction
- Optimizer - analyze page text and provide seo-optimized suggestions for key parts from live data
- ⭐️ API - open up queries on a server for creating interfaces and extensions
- wordsmith studio - UI for composition, word clouding, sales and marketing copy development, trend
- Notion Plugin - generate reports on-the-fly or with a schedule
- Link crawler - load a link, find more links, repeat - build a sitemap of a domain
- Intralink tool - scan article text from a url, and crawl a domain to find related links - provide updated article text with hrefs
- Sentiment analysis - target multiple public posting sites to get general sentiment on a brand, product, news, or any topic
- Backlink Checker - checks all links on a given page to ensure they are still alive. This should be a normal process to protect search rankings. If any backlinks go down, your ranking can be imnpacted negatively. Image checking, video and media, js/css, 3rd-party resource uptime
- Use N-Grams for keyword analysis

---

Rebrand idea:

RUMOR
seo toolkit for development

# Website Auditing Suite

## Overview

This suite provides a modular CLI and API for running comprehensive audits on websites, including:

- Performance
- SEO
- Accessibility
- UX
- Content
- Security
- Analytics
- Business Alignment
- Reputation

Each audit outputs structured JSON and saves screenshots where relevant. Optional Language Model (LM) analysis (OpenAI/LMStudio) can be enabled for advanced summaries and tagging.

---

## CLI Usage

First-time setup (downloads the Chrome build Puppeteer drives):

```bash
npm run setup-browser
```

```bash
node src/scripts/audit.js <url> [options]
```

### Options

- `-a, --audits <types>`: Comma-separated list of audits to run (default: all)
- `--skipLM`: Skip language model analysis steps
- `-o, --output <file>`: Output JSON file path
- `--outputDir <dir>`: Directory for screenshots and results (default: audit-results)

### Examples

```bash
# Run all audits
node src/scripts/audit.js example.com

# Run only performance and SEO
node src/scripts/audit.js example.com --audits performance,seo

# Skip LM analysis
node src/scripts/audit.js example.com --skipLM

# Specify output file and directory
node src/scripts/audit.js example.com -o myresults.json --outputDir my-audit-dir
```

---

## Audit Types

- `performance`: Core Web Vitals, JS size, lazy loading, etc.
- `seo`: Metadata, headings, alt text, links, robots/sitemap, etc.
- `accessibility`: Color contrast, ARIA, keyboard nav, alt text, skip links, etc.
- `ux`: Navigation, CTAs, mobile meta, etc.
- `content`: Word count, headings, images, links, etc.
- `security`: SSL, headers, CSP, HSTS, etc.
- `analytics`: GA, GTM, FB Pixel, consent, etc.
- `business`: Value prop, contact, CTAs, testimonials, etc.
- `reputation`: Social links, review scraping (Google/Yelp), etc.

---

## Language Model (LM) Analysis

### How to Enable

- By default, LM analysis is enabled if you provide a config.
- To skip LM steps, use `--skipLM`.

### Configuration

- Create a `lm-config.json` in your project root, or set environment variables:
  - `LM_PROVIDER` (`openai` or `lmstudio`)
  - `OPENAI_API_KEY` (for OpenAI)
  - `LMSTUDIO_ENDPOINT` (for LMStudio)
  - `LM_MODEL` (e.g., `gpt-4`)
- Or set `LM_CONFIG_PATH` to a custom config file.

#### Example `lm-config.json`

```json
{
  "provider": "openai",
  "apiKey": "sk-...",
  "model": "gpt-4"
}
```

### What LM Analysis Does

- Summarizes audit results in natural language
- Tags issues and strengths
- Can provide sentiment, recommendations, and more

### Developer Plan for LM Analysis

- Each audit module calls the LM interface with a summary prompt and audit data
- If LM config is missing or `--skipLM` is set, LM steps are skipped
- LM interface supports both OpenAI and LMStudio
- Future: Add more granular prompts, allow custom prompts, support for tagging/classification, and multi-step LM workflows

---

## Developer Notes

- Each audit is a module in `src/audits/` and exports a function (e.g., `runPerformanceAudit`)
- To add a new audit, create a new module and add it to the CLI runner
- Use browserless for scraping, screenshots, and DOM evaluation
- Use the LM interface for advanced analysis (see `src/audits/lm-interface.js`)
- Output structured JSON and save screenshots to disk
- Prefer free/open APIs and scraping over paid services

---

## Troubleshooting

- If you see errors about missing Lighthouse data, check that the URL is reachable and starts with `https://` (the CLI will auto-prefix if needed)
- If audits fail, check the output JSON for error messages
- For LM errors, check your config and API keys
