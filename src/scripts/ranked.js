#!/usr/bin/env node
import createBrowser from "browserless";
import { Command } from "commander";
import chalk from "chalk";
import { onExit } from "signal-exit";
import termImg from "term-img";
// import { writeFile } from "fs/promises";

import path from "path";
import { fileURLToPath } from "url";

// Get the current file's directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const browser = createBrowser({
  timeout: 120000,
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
    // adblock: !options.ads,
  };
};

const dateNow = () => new Date().toLocaleString().replace(/[\W]+/g, "-");

const getGoogleSearchUrl = (query, options) => {
  const queryParam = query ? escape(query.replace(/\s/g, "+")) : '';
  const link = options.linkbacks ? `link%3A${options.linkbacks}+-site%3A${options.linkbacks}` : '';
  if (!queryParam && !link) {
    throw new Error('There is no search query or site link query set');
  }
  const excludes = [].concat(options.exclude).map((s) => `-site%3A${s}`);
  return `https://google.com/search?q=${[link || queryParam].concat(excludes).join("+")}`;
};

async function extractQueryRankings(browserless, searchQuery, options) {
  const extractedTexts = await browserless.evaluate(async (page) => {
    await page.setViewport({
      width: 1920 / 2,
      height: 1080 * 2, // possibly load more results
    });
    /**
     * ... the meat
     */
    if (options.screenshot) {
      const buffer = await page.screenshot({
        path: path.join(__dirname, `../output/screenshot_${dateNow()}}.png`),
        type: "png",
      });
      if (!options.json) {
        console.log(termImg(buffer));
        console.log(chalk.green("✔ screenshot saved"));
      }
    }

    const allResultUrls = await page.evaluate(() => {
      const getUrlAttribute = (href) => {
        const innerUrlRegex = /(?:url=)(https?.*?)(&|$)/;
        const matches = href.match(innerUrlRegex);
        return matches && matches[1] ? matches[1] : null;
      };
      const urls = Array.from(document.querySelectorAll("a[href][data-ved]"));

      return urls
        .map((url) => ({
          url: getUrlAttribute(url.getAttribute("href")),
          title: url.querySelector("h3")
            ? url.querySelector("h3").textContent
            : null,
        }))
        .filter(({ url, title }) => !!url && !!title);
    });
    return allResultUrls;
  }, getGotoOptions(options));

  const mainUrl = getGoogleSearchUrl(searchQuery, options);
  let pages = options.pages;
  let results = [];

  while (pages > 0) {
    pages--;
    const url = results.length ? mainUrl + `&start=${results.length}` : mainUrl;
    const resultData = await extractedTexts(url);
    results.push(
      ...resultData.map((url, i) => ({ ...url, rank: results.length + i + 1 })),
    );
  }

  return results;
}

function prettyPrint(searchQuery, options, queryResults) {
  if (options.linkbacks) {
    console.log(
      chalk.grey(`Top ${queryResults.length} sites that link back to `) +
        chalk.bold(`"${options.linkbacks}"`),
      options.exclude.length
        ? chalk.gray(`(excluding ${options.exclude.join(", ")})`)
        : "",
    );
  } else {
    console.log(
      chalk.grey(`Top ${queryResults.length} results for `) +
        chalk.bold(`"${searchQuery}"`),
      options.exclude.length
        ? chalk.gray(`(excluding ${options.exclude.join(", ")})`)
        : "",
    );
  }
  queryResults.forEach((result, i) => {
    const url = new URL(result.url);
    console.log(
      `${i + 1}. ${result.url.replace(url.hostname, chalk.bold(url.hostname))}\n\t${chalk.gray(result.title)}`,
    );
  });
}

// Set the args for the cli script
const program = new Command();
program
  .name("ranked")
  .description("Get rankings for a query from google.com")
  .argument("[searchQuery]", "The query you want to get rankings for", null)
  .option("-j, --json", "Print json results (default is pretty-print)")
  .option("-s, --screenshot", "Get screenshot of the results")
  .option(
    "-l, --linkbacks <linkbackUrl>",
    "Get list of sites that link back to this url",
  )
  .option("-p, --pages <count>", "Number of pages to load (autoscroller)", 1)
  .option(
    "-x, --exclude <exclude...>",
    "Exclude certain sites from results",
    [],
  )
  .helpOption("-h, --help", "display help for command")
  .addHelpCommand(false) // disables default help command
  .showHelpAfterError(chalk.red("Add --help for additional information"))
  .action(async (searchQuery, options) => {
    try {
      // Browser contexts are like browser tabs
      // You can create as many as your resources can support
      // Cookies/caches are limited to their respective browser contexts, just like browser tabs
      const browserless = await browser.createContext();

      const queryResults = await extractQueryRankings(
        browserless,
        searchQuery,
        options,
      );

      /**
       * Log Result Synonyms
       */
      if (!options.json) prettyPrint(searchQuery, options, queryResults);
      else console.log(queryResults);

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
