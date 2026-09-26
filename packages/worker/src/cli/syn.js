#!/usr/bin/env node
/**
 * `syn` — synonyms and related words for a word, from Thesaurus.com.
 *
 * The scraping lives in @wordsmith/core. This file parses arguments and
 * renders; it used to carry its own copy of the scraper, and the two drifted —
 * core's destroyed the browser context before reading the results.
 */
import { Command } from "commander";
import chalk from "chalk";
import { extractSynonyms } from "@wordsmith/core/scrapers/syn.js";
import { closeBrowser } from "@wordsmith/core/adapters/browser.js";

/** Stronger matches read brighter. */
const strengthColour = {
  3: chalk.green,
  2: chalk.white,
  1: chalk.gray,
};

function prettyPrint(results) {
  console.log("\n");
  console.log(chalk.bold("Synonyms"));
  console.log(
    results.synonyms
      .map((syn) => {
        const paint = strengthColour[syn.strength] || chalk.white;
        return `${chalk.gray(`[${syn.type}]`)}\n${paint(syn.synonyms.join(", "))}`;
      })
      .join("\n\n"),
  );
  console.log("\n");
  console.log(chalk.bold("Related Words"));
  console.log(
    results.relatedWords
      .map(
        (rlw) =>
          `${chalk.gray(`[${rlw.type}]`)}\n${rlw.relatedWords.join(", ")}`,
      )
      .join("\n\n"),
  );
}

/** Every word the lookup produced, in one flat deduplicated list. */
function allWords(results) {
  const words = [
    ...results.relatedWords.flatMap((r) => r.relatedWords),
    ...results.synonyms.flatMap((s) => s.synonyms),
  ];
  return [...new Set(words)];
}

const program = new Command();
program
  .name("wordsmith-synonyms")
  .description("Get synonyms for a word using Thesaurus.com")
  .argument("<word>", "word to get synonyms for")
  .option("-a, --allWords", "Combine results into a list of all words")
  .option("-p, --pretty", "Print format, otherwise its json by default")
  .option("-s, --strength <strength>", "Show strength of N or higher (1, 2, 3)")
  .option(
    "-w, --wordType <wordType>",
    "Show only word type of [noun, verb, adjective, etc]",
  )
  .helpOption("-h, --help", "display help for command")
  .addHelpCommand(false)
  .showHelpAfterError(chalk.red("Add --help for additional information"))
  .action(async (word, options) => {
    try {
      const results = await extractSynonyms(word, {
        strength: options.strength ? Number(options.strength) : undefined,
        wordType: options.wordType,
      });

      if (options.pretty) prettyPrint(results);
      else if (options.allWords) console.log(allWords(results));
      else console.log(JSON.stringify(results, null, 2));
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exitCode = 1;
    } finally {
      // An open browser keeps the process alive; a CLI has to say when it is done.
      await closeBrowser();
    }
  });

program.parse(process.argv);
