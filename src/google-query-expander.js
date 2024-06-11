import createBrowser from "browserless";
import { Command } from "commander";
import chalk from "chalk";
import { onExit } from "signal-exit";
import { writeFile } from "fs/promises";

const browser = createBrowser({
  timeout: 120000,
  // ignoreHTTPSErrors: true
  // lossyDeviceName: true,
});
onExit(browser.close);

const defaultGotoOptions = {
  device: "macbook pro 13",
  waitUntil: "auto",
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

const googleDotCom = "http://www.google.com";
// const googleSearchInputSelectorNew = 'form textarea[role="combobox"]';
const googleSearchInputSelector = 'form input[title="Google Search"]';
// const googleQueryListboxSelectorNew = '[role="listbox"] ul';
const googleQueryListboxSelector = "body > table:last-child";
// const googleQueryLiSelectorNew = 'li[data-attrid="AutocompletePrediction"]';
// const googleQueryTextSelectorNew = googleQueryLiSelectorNew +
//   'div[aria-atomic="true"][role="option"] > div[role="presentation"] > span > b';
const googleQueryTextSelector =
  'tr > td > div > table[role="presentation"] > tbody > tr > td > span > b';
// or
/**
 * search elements by <google search query string> && contains <b>
the <b> has the query completion
 */

// Type the search query in the search box

const pause = (delay) =>
  new Promise((resolve) => {
    setTimeout(() => resolve(), delay);
  });
const dateNow = () => new Date().toLocaleString().replace(/[\W]+/g, "-");

async function extractQueryCompletions(browserless, phrase, options) {
  const extractedTexts = await browserless.evaluate(
    async (page) => {
      await page.setViewport({
        width: 1920,
        height: 1080,
      });
      await page.click("form");
      console.log("searching for form input");
      const searchInputHandle = await page.waitForSelector(
        googleSearchInputSelector,
        { visible: true, timeout: 4000 },
      );
      console.log("form found");
      // Type the search phrase
      await searchInputHandle.type(phrase);
      searchInputHandle.dispose(); // done with this

      // Wait for the suggested results to pop up

      // Allow autocomplete to finish after typing
      await pause(2000);

      // Debug output
      const listboxHtml = await page.evaluate(
        (selector) => document.querySelector(selector).outerHTML,
        googleQueryListboxSelector,
      );
      const listboxHandle = await page.waitForSelector(
        googleQueryListboxSelector,
      );
      await writeFile(`./output/google-form-${dateNow()}.html`, listboxHtml);
      await page.screenshot({
        path: `./output/screenshot-google-${dateNow()}.jpeg`,
        type: "jpeg",
      });

      // Collect the results
      const querySuggestionResultTexts = await listboxHandle.evaluate(
        (node, selector) => {
          const resultNodes = Array.from(node.querySelectorAll(selector));
          return resultNodes.map((text) => text.textContent.trim());
        },
        googleQueryTextSelector,
      );
      await listboxHandle.dispose(); // done with this

      return querySuggestionResultTexts;
    },
    getGotoOptions({ adblock: !options.ads }),
  );

  return extractedTexts(googleDotCom);
}

// Set the args for the cli script
const program = new Command();
program
  .name("google-query-expander")
  .description("Get completions for first part of search query from google.com")
  .argument("<phrase>", "Beginning of search query to get completions for")
  .option("-a, --ads", "Use ads")
  .helpOption("-h, --help", "display help for command")
  .addHelpCommand(false) // disables default help command
  .showHelpAfterError(chalk.red("Add --help for additional information"))
  .action(async (phrase, options) => {
    try {
      // Browser contexts are like browser tabs
      // You can create as many as your resources can support
      // Cookies/caches are limited to their respective browser contexts, just like browser tabs
      const browserless = await browser.createContext();

      const results = await extractQueryCompletions(
        browserless,
        phrase,
        options,
      );

      /**
       * Log Result Synonyms
       */
      console.log(`Completions for ${phrase}`);
      console.log(results);

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
