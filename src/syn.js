import createBrowser from "browserless";
import { Command } from "commander";
import chalk from "chalk";
import { onExit } from "signal-exit";

const browser = createBrowser({
  timeout: 120000,
  // ignoreHTTPSErrors: true
  // lossyDeviceName: true,
});
onExit(browser.close);

const defaultGotoOptions = {
  device: "macbook pro 13",
  waitUntil: "networkidle2",
  adblock: true,
};

const getGotoOptions = (options) => {
  return {
    ...defaultGotoOptions,
    adblock: !options.ads,
  };
};

function deduplicateWords(words) {
  return [...new Set(words)];
}



const getThesaurusUrl = (word) =>
  `https://www.thesaurus.com/browse/${word.toLowerCase()}`;

async function extractSynonyms(browserless, sourceWord, options) {
  const url = getThesaurusUrl(sourceWord);
  if (options.pretty) console.log("url:", url);

  const extractedTexts = await browserless.evaluate(
    async (page) => {
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
      // Utility function to find an element by text and return the next matching sibling
      async function findElementByTextAndSelectSibling(
        searchText,
        siblingSelector,
        wordTypeLimit,
      ) {
        // Cache elements; we loop thru a few tiems
        elements = elements
          ? elements
          : await page.evaluateHandle(() => document.querySelectorAll("*"));
        // Save synonyms results
        const synonyms = [];
        const properties = await elements.getProperties();
        // Loop thru all elements
        for (const property of properties.values()) {
          const element = property.asElement();
          if (element) {
            const textContent = await page.evaluate(
              (el) => el.textContent,
              element,
            );
            // Check if the element's text _exactly_ matches search text
            if (textContent === searchText) {
              // Find the next sibling
              const sibling = await page.evaluateHandle(
                (el) => el.nextElementSibling,
                element,
              );
              // 🚨 See if its a p or ul (this is where the words are)
              const isMatch = await sibling.evaluate(
                (node, siblingSelector) => {
                  return node && node.matches(siblingSelector);
                },
                siblingSelector,
              );
              if (isMatch) {
                /**
                 * Get the type of word info
                 */
                const foundWordType = await sibling.evaluate((node) => {
                  // Navigate 4 levels up
                  let currentElement = node;
                  for (let i = 0; i < 4; i++) {
                    if (currentElement.parentElement) {
                      currentElement = currentElement.parentElement;
                    } else {
                      // Return null if there aren't enough parents
                      return null;
                    }
                  }
                  // Select the first paragraph within the ancestor element
                  // and then get the part of speech word from the text
                  const textInfoEl = currentElement.querySelector("p");
                  const text = textInfoEl.textContent.split("as in")[0];
                  return text ? text.trim().toLowerCase() : "unknown";
                });

                // Skip this word type if the option is set and it doesnt match
                if (
                  wordTypeLimit &&
                  foundWordType !== wordTypeLimit.toLowerCase()
                ) {
                  continue;
                }

                /**
                 * Get the synonym text
                 */
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

        // Return the synonyms
        return synonyms;
      }

      // Set up the final results object
      const results = {
        synonyms: [],
        relatedWords: [],
      };
      // Iterate over the predefined matchStrengthText to find and extract text from matching ul elements
      for (let text of Object.keys(matchStrengthText)) {
        const resultWords = await findElementByTextAndSelectSibling(
          text,
          selector,
          options.wordType,
        );
        results.synonyms.push(...resultWords);
      }
      /**
       * Get related words
       */
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
          if (
            options.wordType &&
            wordType !== options.wordType.toLowerCase()
          ) {
            continue;
          }
          relatedWords.push({
            type: wordType,
            relatedWords: [rootWord, ...wordList].sort((a, b) => a.length - b.length),
          });
        }
        return relatedWords;
      }, options);
      results.relatedWords = resultRelatedWords;
      return results;
    },
    getGotoOptions({ adblock: !options.ads }),
  );

  return extractedTexts(url);
}

const sLabelChalk = {
  3: msg => chalk.green(msg),
  2: msg => chalk.white(msg),
  1: msg => chalk.gray(msg)
}

// Set the args for the cli script
const program = new Command();
program
  .name("wordsmith-synonyms")
  .description("Get synonyms for a word using Thesaurus.com")
  .argument("<word>", "word to get synonyms for")
  .option("-a, --ads", "Use ads")
  .option("-p, --pretty", "Print format, otherwise its json by default")
  .option("-s, --strength <strength>", "Show strength of N or higher (1, 2, 3)")
  .option(
    "-w, --wordType <wordType>",
    "Show only word type of [noun, verb, adjective, etc]",
  )
  .helpOption("-h, --help", "display help for command")
  .addHelpCommand(false) // disables default help command
  .showHelpAfterError(chalk.red("Add --help for additional information"))
  .action(async (word, options) => {
    try {
      // Browser contexts are like browser tabs
      // You can create as many as your resources can support
      // Cookies/caches are limited to their respective browser contexts, just like browser tabs
      const browserless = await browser.createContext();

      const results = await extractSynonyms(browserless, word, options);

      /**
       * Log Result Synonyms
       */
      if (options.pretty) {
        console.log('\n');
        console.log(chalk.bold('Synonyms'));
        console.log(
          results.synonyms
            .map(
              (syn) => {
                const title = chalk.gray(`[${syn.type}]`);
                const items = sLabelChalk[syn.strength](syn.synonyms.join(", "));
                return title + '\n' + items;
              }
            )
            .join("\n\n"),
        );
        console.log('\n');
        console.log(chalk.bold('Related Words'));
        console.log(results.relatedWords.map(
          (rlw) => {
            const title = chalk.gray(`[${rlw.type}]`);
            const items = rlw.relatedWords.join(", ");
            return title + '\n' + items
          }
        )
        .join("\n\n"),);
      } else {
        console.log(JSON.stringify(results, null, 2));
      }

      // After your task is done, destroy your browser context
      await browserless.destroyContext();

      // At the end, gracefully shutdown the browser process
      await browser.close();
      process.exit();
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit();
    }
  });

// Process script with args
program.parse(process.argv);
