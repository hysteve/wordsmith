#!/usr/bin/env node
import createBrowser from "browserless";
import { Command } from "commander";
import chalk from "chalk";
import { onExit } from "signal-exit";
import termImg from 'term-img';
// import { writeFile } from "fs/promises";

import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// function deduplicateWords(words) {
//   return [...new Set(words)];
// }

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
  let phrases = [phrase];
  if (options.cascade) {
    const [a, b, ...rest] = phrase.split(' ');
    phrases = [`${a} ${b}`, ...rest.map(s => ` ${s}`)];
  }

  const extractedTexts = await browserless.evaluate(
    async (page) => {
      const completions = [];
      await page.setViewport({
        width: 500,
        height: 600
    });
      const searchInputHandle = await page.waitForSelector(
        googleSearchInputSelector,
        { visible: true, timeout: 4000 },
      );
      await page.evaluate(() => {
        const login = document.querySelector('iframe');
        if (login && login.remove) login.remove();
      });
      let searchValue = ''
      // Type the next search phrase
      for (let nextPhrase of phrases) {
        await searchInputHandle.type(nextPhrase);
        searchValue = await searchInputHandle.evaluate(node => node.value);
        // Wait for the suggested results to pop up
        // Allow autocomplete to finish after typing
        await pause(options.delay);
  
        // Debug output
        // const listboxHtml = await page.evaluate(
        //   (selector) => document.querySelector(selector).outerHTML,
        //   googleQueryListboxSelector,
        // );
        const listboxHandle = await page.waitForSelector(
          googleQueryListboxSelector,
          { visible: true }
        );
        // await writeFile(`./output/google-form-${dateNow()}.html`, listboxHtml);
  
        // Collect the results
        const queryCompletionResultTexts = await listboxHandle.evaluate(
          (node, selector) => {
            const resultNodes = Array.from(node.querySelectorAll(selector));
            return resultNodes.map((text) => text.textContent.trim());
          },
          googleQueryTextSelector,
        );
        await listboxHandle.dispose(); // done with this

        completions.push({
          query: searchValue, // phrases.slice(0, phrases.indexOf(nextPhrase)).join(' '),
          completions: queryCompletionResultTexts
        });

        if (options.screenshot) {
          const buffer = await page.screenshot({
            path: path.join(__dirname, `../output/screenshot-google__${dateNow()}__${searchValue.split(' ').join('-')}.png`),
            type: "png",
          });
          if (!options.json) {
            console.log(termImg(buffer));
            console.log(chalk.green('✔ screenshot saved'));
          }
        }
      }

      await searchInputHandle.dispose(); // done with this

      return completions;
    },
    getGotoOptions({ adblock: !options.ads }),
  );
  
  return extractedTexts(googleDotCom);
}

const results = {
  phrase: 'good dog grooming services',
  datetime: new Date(),
  completions: [
    {
      query: 'good dog',
      completions: ['...']
    },
    {
      query: 'good dog grooming',
      completions: ['...']
    },
    {
      query: 'good dog grooming services',
      completions: ['...']
    }
  ],
}

function prettyPrint(results) {
  console.log(chalk.gray('Google Completions for: ') + chalk.bold(`"${results.phrase}"`));
  results.completions.forEach(completion => {
    console.log(chalk.gray('Query: ') + chalk.bold(`"${completion.query}"`));
    console.log(chalk.white(completion.completions.join(', ')));
  })
}

// Set the args for the cli script
const program = new Command();
program
  .name("google-query-expander")
  .description("Get completions for first part of search query from google.com")
  .argument("<phrase>", "Beginning of search query to get completions for")
  .option("-a, --ads", "Use ads")
  .option("-c, --cascade", "Enter 1 word from your query at a time, capturing completions for each")
  .option("-j, --json", "Print json results (default is pretty-print)")
  .option("-d, --delay", "Delay between typing and grabbing completion results (default 2000)", 1000)
  .option("-s, --screenshot", "Get screenshot of the results")
  .helpOption("-h, --help", "display help for command")
  .addHelpCommand(false) // disables default help command
  .showHelpAfterError(chalk.red("Add --help for additional information"))
  .action(async (phrase, options) => {
    try {
      // Browser contexts are like browser tabs
      // You can create as many as your resources can support
      // Cookies/caches are limited to their respective browser contexts, just like browser tabs
      const browserless = await browser.createContext();

      const completions = await extractQueryCompletions(
        browserless,
        phrase,
        options,
      );

      const results = {
        phrase,
        completions,
        datetime: (new Date()).toISOString(),
      }

      /**
       * Log Result Synonyms
       */
      if (!options.json) prettyPrint(results)
        else console.log(results);

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
