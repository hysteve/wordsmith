#!/usr/bin/env node
/**
 * `ranked` — top Google results for a query, or backlinks to a URL.
 *
 * The scraping lives in @wordsmith/core. This file parses arguments and
 * renders; it used to carry its own copy of the scraper, which drifted from
 * core's and meant a fix had to be made twice.
 */
import { Command } from "commander";
import chalk from "chalk";
import termImg from "term-img";
import fs from "fs/promises";
import { extractQueryRankings } from "@wordsmith/core/scrapers/ranked.js";
import { closeBrowser } from "@wordsmith/core/adapters/browser.js";

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
      const { results, screenshot } = await extractQueryRankings(searchQuery, {
        linkbacks: options.linkbacks,
        pages: Number(options.pages) || 1,
        exclude: options.exclude,
        screenshot: Boolean(options.screenshot),
      });

      if (options.json) console.log(JSON.stringify(results, null, 2));
      else prettyPrint(searchQuery, options, results);

      if (screenshot && !options.json) {
        termImg(await fs.readFile(screenshot), { fallback: () => {} });
        console.log(chalk.green(`\u2714 screenshot saved to ${screenshot}`));
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exitCode = 1;
    } finally {
      // An open browser keeps the process alive; a CLI has to say when it is done.
      await closeBrowser();
    }
  });

// Process script with args
program.parse(process.argv);
