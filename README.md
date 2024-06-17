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

You can also get *backlinks* easily using `ranked -l <url>`.

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


## Future Tools

- Brand Pilot - create, extract, tweak, and analyze a brand web presence
	- https://github.com/puppeteer/puppeteer/blob/ddc59b247282774ccc53e3cc925efc30d4e25675/docs/api.md#pageexposefunctionname-puppeteerfunction
- Optimizer - analyze page text and provide seo-optimized suggestions for key parts from live data
- ⭐️ API - open up queries on a server for creating interfaces and extensions
- wordsmith studio - UI for composition, word clouding, sales and marketing copy development, trend 
- Notion Plugin - generate reports on-the-fly or with a schedule