import createBrowser from "browserless";
import { onExit } from "signal-exit";

const browser = createBrowser({ timeout: 120000 });
onExit(browser.close);

const defaultGotoOptions = {
  device: "macbook pro 13",
  waitUntil: "networkidle2",
  adblock: true,
};

const getGotoOptions = (options) => {
  return {
    ...defaultGotoOptions,
  };
};

const getThesaurusUrl = (word) =>
  `https://www.thesaurus.com/browse/${word.toLowerCase()}`;

// function deduplicateWords(words) {
//   return [...new Set(words)];
// }

export async function extractSynonyms(word, options) {
  const url = getThesaurusUrl(word);
  console.log("Extract synonyms for url:", url);
  const browserless = await browser.createContext();

  const extractedTexts = await browserless.evaluate(async (page) => {
    const matchStrengthText = {
      "Strongest matches": 3,
      "Strongest match": 3,
      "Strong matches": 2,
      "Strong match": 2,
      "Weak matches": 1,
      "Weak match": 1,
    };
    if (options.strength) {
      Object.keys(matchStrengthText).forEach((key) => {
        if (matchStrengthText[key] < options.strength)
          delete matchStrengthText[key];
      });
    }
    const selector = "p,ul";
    let elements;

    async function findElementByTextAndSelectSibling(
      searchText,
      siblingSelector,
      wordTypeLimit,
    ) {
      elements = elements
        ? elements
        : await page.evaluateHandle(() => document.querySelectorAll("*"));
      const synonyms = [];
      const properties = await elements.getProperties();
      for (const property of properties.values()) {
        const element = property.asElement();
        if (element) {
          const textContent = await page.evaluate(
            (el) => el.textContent,
            element,
          );
          if (textContent === searchText) {
            const sibling = await page.evaluateHandle(
              (el) => el.nextElementSibling,
              element,
            );
            const isMatch = await sibling.evaluate(
              (node, siblingSelector) => node && node.matches(siblingSelector),
              siblingSelector,
            );
            if (isMatch) {
              const foundWordType = await sibling.evaluate((node) => {
                let currentElement = node;
                for (let i = 0; i < 4; i++) {
                  if (currentElement.parentElement) {
                    currentElement = currentElement.parentElement;
                  } else {
                    return null;
                  }
                }
                const textInfoEl = currentElement.querySelector("p");
                const text = textInfoEl.textContent.split("as in")[0];
                return text ? text.trim().toLowerCase() : "unknown";
              });

              if (
                wordTypeLimit &&
                foundWordType !== wordTypeLimit.toLowerCase()
              ) {
                continue;
              }

              const foundSynonyms = await sibling.evaluate((node) => {
                const liItems = node.querySelectorAll("li");
                if (liItems && liItems.length) {
                  return Array.from(liItems).map((li) => li.textContent);
                }
                return node.textContent.split(", ");
              });

              sibling.dispose();

              synonyms.push({
                type: foundWordType,
                strength: matchStrengthText[searchText],
                synonyms: foundSynonyms.sort((a, b) => a.length - b.length),
              });
            }
          }
        }
      }
      return synonyms;
    }

    const results = { word, synonyms: [], relatedWords: [] };
    for (let text of Object.keys(matchStrengthText)) {
      const resultWords = await findElementByTextAndSelectSibling(
        text,
        selector,
        options.wordType,
      );
      results.synonyms.push(...resultWords);
    }

    const resultRelatedWords = await page.evaluate(async (options) => {
      const relatedWordCards = Array.from(
        document.querySelectorAll(
          '#related-words [data-type="related-word-card"]',
        ),
      );
      let relatedWords = [];
      for (let node of relatedWordCards) {
        node.setAttribute("open", true);
        const rootWord = node.querySelector("summary > div > a").textContent;
        const wordType = node.querySelector(
          "summary > div > p > span",
        ).textContent;
        const wordList = Array.from(node.querySelectorAll("ul > li")).map(
          (li) => li.textContent,
        );
        if (options.wordType && wordType !== options.wordType.toLowerCase()) {
          continue;
        }
        relatedWords.push({
          type: wordType,
          relatedWords: [rootWord, ...wordList].sort(
            (a, b) => a.length - b.length,
          ),
        });
      }
      return relatedWords;
    }, options);
    results.relatedWords = resultRelatedWords;
    return results;
  }, getGotoOptions(options));

  // After your task is done, destroy your browser context
  await browserless.destroyContext();

  return extractedTexts(url);
}
