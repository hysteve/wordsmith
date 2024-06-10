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
