# Wordsmith
> Tools for smithing with words

## Syn - Get synonyms for a word from Thesaurus.com

Uses browserless and a custom scraper to pull out synonyms for a given word. You can specify if you want only the noun, verb, adjective synonyms or only want stronger matches.

This is based on the current html structure and could break anytime Thesaurus.com changes their site.
Written 6/10/2024, 12:49:15 PM.

```bash
node src/syn.js redemption -w noun -s 2
```

**Usage**
-w, --wordType: noun, verb, adjective, etc
-s, --strength: 1, 2, or 3, higher = stronger

## Google Query Expander - get live search completions for a search phrase from Google

Uses browserless and a custom scraper to type a search query into google and pull the resulting search completions out into a text result. Useful for compiling search queries to optimize a webpage for, to check rankings for (possible upcoming tool), and for using brand keywords to find related search ternms that you can experiment with ranking in.

## (Future) Google Query Rankings - get the top ranking sites for a specific search query in Google