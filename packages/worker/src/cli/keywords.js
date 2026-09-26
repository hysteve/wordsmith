#!/usr/bin/env node
/**
 * `keywords` — word, pair and triplet counts for a page.
 *
 * The extraction lives in @wordsmith/core. This file parses arguments and
 * renders; it used to carry its own copy of the parser and the scraper.
 */
import { Command } from "commander";
import chalk from "chalk";
import { parseKeywords } from "@wordsmith/core/scrapers/keywords.js";
import { closeBrowser } from "@wordsmith/core/adapters/browser.js";

function prettyPrint(url, result) {
  console.log(chalk.gray("Keywords for"), chalk.white(url));
  console.log("Word counts:", result.words);
  console.log("Word pairs:", result.pairs);
  console.log("Word triplets:", result.triplets);
}

const program = new Command();
program
  .name("keywords")
  .description("Get keywords from a webpage")
  .argument("<url>", "The page to get keywords from")
  .option("-j, --json", "Print json results (default is pretty-print)")
  .option(
    "-m, --minCount <minCount>",
    "Only include words found at least N times",
    2,
  )
  .helpOption("-h, --help", "display help for command")
  .addHelpCommand(false)
  .showHelpAfterError(chalk.red("Add --help for additional information"))
  .action(async (url, options) => {
    try {
      const result = await parseKeywords(url, {
        minCount: Number(options.minCount) || 2,
      });

      if (options.json) console.log(JSON.stringify(result, null, 2));
      else prettyPrint(url, result);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exitCode = 1;
    } finally {
      // An open browser keeps the process alive; a CLI has to say when it is done.
      await closeBrowser();
    }
  });

program.parse(process.argv);
