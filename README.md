# Wordsmith
> Tools for smithing with words

## Syn - Get synonyms for a word from Thesaurus.com

Uses browserless and a custom scraper to pull out synonyms for a given word. You can specify if you want only the noun, verb, adjective synonyms or only want stronger matches.

This is based on the current html structure and could break anytime Thesaurus.com changes their site.
Written 6/10/2024, 12:49:15 PM.

```bash
node src/syn.js redemption -w noun -s 3 --pretty

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

**Usage**
-w, --wordType: noun, verb, adjective, etc
-s, --strength: 1, 2, or 3, higher = stronger

## Google Query Expander - get live search completions for a search phrase from Google

Uses browserless and a custom scraper to type a search query into google and pull the resulting search completions out into a text result. Useful for compiling search queries to optimize a webpage for, to check rankings for (possible upcoming tool), and for using brand keywords to find related search ternms that you can experiment with ranking in.

## Features
- `"-c, --cascade"` - Cascade search - Splits the initial phrase into parts, and incrementally adds the terms, capturing results at each new word addition
- Adjust pause - there is a pause after entering search terms to allow the completions to populate; configure it with `"-d"`
- Pretty-print by default, output json with `"-j"`
- Take a screenshot with `"-s"`

> Note: This is an alpha version, please report bugs and improvement ideas

```bash
node src/google-query-expander.js "good dog"

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

## (Future) Google Query Rankings - get the top ranking sites for a specific search query in Google
