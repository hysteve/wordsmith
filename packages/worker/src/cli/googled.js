#!/usr/bin/env node
/**
 * `googled` — live Google search completions for a phrase.
 *
 * The scraping lives in @wordsmith/core. This file parses arguments and
 * renders; it used to carry its own copy of the scraper.
 */
import { Command } from "commander";
import chalk from "chalk";
import { extractQueryCompletions } from "@wordsmith/core/scrapers/googled.js";
import { closeBrowser } from "@wordsmith/core/adapters/browser.js";

function prettyPrint(results) {
  console.log(
    chalk.gray("Google Completions for: ") + chalk.bold(`"${results.phrase}"`),
  );
  for (const completion of results.completions ?? []) {
    console.log(chalk.gray("Query: ") + chalk.bold(`"${completion.query}"`));
    console.log(chalk.white(completion.completions.join(", ")));
  }
}

const program = new Command();
program
  .name("google-query-expander")
  .description("Get completions for first part of search query from google.com")
  .argument("<phrase>", "Beginning of search query to get completions for")
  .option(
    "-c, --cascade",
    "Enter 1 word from your query at a time, capturing completions for each",
  )
  .option("-j, --json", "Print json results (default is pretty-print)")
  .option(
    "-d, --delay <ms>",
    "Delay between typing and grabbing completion results",
    1000,
  )
  .option("-l, --limit <count>", "Limit number of results", 5)
  .helpOption("-h, --help", "display help for command")
  .addHelpCommand(false)
  .showHelpAfterError(chalk.red("Add --help for additional information"))
  .action(async (phrase, options) => {
    try {
      const completions = await extractQueryCompletions(phrase, {
        cascade: Boolean(options.cascade),
        delay: Number(options.delay) || 1000,
        limit: Number(options.limit) || 5,
      });

      const results = {
        phrase,
        completions,
        datetime: new Date().toISOString(),
      };

      if (options.json) console.log(JSON.stringify(results, null, 2));
      else prettyPrint(results);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exitCode = 1;
    } finally {
      // An open browser keeps the process alive; a CLI has to say when it is done.
      await closeBrowser();
    }
  });

program.parse(process.argv);
