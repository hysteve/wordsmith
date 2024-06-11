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
googled "good dog"

Completions for good dog
[
  'names',
  'food',
  'food brands',
  'carl',
  'foundation',
  'pet training',
  'breeds',
  'names for boys'
]
```

Future improvements:
- Swap Terms - Search for multiple alternate terms for a cascaded search

## Ranked - Google Query Rankings - get the top ranking sites for a specific search query in Google

Pass in a query, get rankings. That simple. That powerful.

For features, do `ranked -h`.

```bash
ranked "get lit lighting"

Top 10 results for "get lit lighting"
1. https://getlitledlighting.com/
	Get Lit LED Lighting
2. https://www.getliteventlighting.com/
	Get Lit Event Lighting
3. https://www.getlitltd.com/
	Get Lit, LTD. - designer lighting for the wholesale trade
4. https://getlitledlighting.com/collections/all
	ALL PRODUCTS | Get Lit LED Lighting Store
5. https://getlitus.com/
	Get Lit
6. https://www.instagram.com/getlitledlighting/%3Fhl%3Den
	GET LIT LED LIGHTING (@getlitledlighting) - Instagram
7. https://getlitlighting.com/
	GET LIT LIGHTING | Get lit for the Holidays! Serving the Eastside ...
8. https://getlitproductions.com/
	Get Lit Productions INC | Party & Event Lighting - Orlando FL
9. https://getlitlightingllc.com/
	Get Lit Lighting, LLC. - Christmas & Holiday Light Installation
10. https://www.facebook.com/getlitlights/
	Get Lit Lights - Facebook
```

## (Future) Page Keyword Extractor - grab and analyze meaningful keywords from any webpage
