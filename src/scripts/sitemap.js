#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { sitemap } from "../api/sitemap/sitemap-module.js";
import { writeFile } from "fs/promises";

// Set the args for the cli script
const program = new Command();
program
  .name("sitemap")
  .description("Find and analyze sitemap of a website")
  .argument("<url>", "The website to analyze")
  .option("-j, --json", "Print json results (default is pretty-print)")
  .option("-o, --output <file>", "Output file path")
  .option(
    "-c, --command <command>",
    "Command to run on each URL (use {url} as placeholder)",
  )
  .option("--crawl", "Crawl each URL in the sitemap")
  .helpOption("-h, --help", "display help for command")
  .addHelpCommand(false)
  .showHelpAfterError(chalk.red("Add --help for additional information"))
  .action(async (url, options) => {
    try {
      const results = await sitemap(url, options);

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        prettyPrint(url, options, results);
      }

      if (options.output) {
        await writeFile(options.output, JSON.stringify(results, null, 2));
      }

      if (options.command) {
        // Implement command execution logic here
        console.log("Command execution not implemented yet");
      }

      process.exit();
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

function prettyPrint(url, options, results) {
  console.log(chalk.gray("Sitemap analysis for"), chalk.white(url));
  console.log(chalk.gray("Found sitemap at:"), chalk.white(results.sitemapUrl));
  console.log(chalk.gray("Total links:"), chalk.white(results.totalLinks));

  console.log("\n" + chalk.cyan("Link Categories:"));
  console.log(chalk.gray("Internal:"), chalk.white(results.internal.length));
  console.log(
    chalk.gray("Navigation:"),
    chalk.white(results.navigation.length),
  );
  console.log(chalk.gray("External:"), chalk.white(results.external.length));
  console.log(chalk.gray("Other:"), chalk.white(results.other.length));

  if (options.command && results.commandResults) {
    console.log("\n" + chalk.cyan("Command Results:"));
    results.commandResults.forEach(({ url, stdout, stderr, error }) => {
      console.log(chalk.gray("URL:"), chalk.white(url));
      if (error) {
        console.log(chalk.red("Error:"), error);
      } else {
        if (stdout) console.log(chalk.gray("Output:"), stdout);
        if (stderr) console.log(chalk.yellow("Errors:"), stderr);
      }
    });
  }

  if (options.crawl && results.crawlResults) {
    console.log("\n" + chalk.cyan("Crawl Results:"));
    results.crawlResults.forEach(({ url, success, error }) => {
      console.log(chalk.gray("URL:"), chalk.white(url));
      console.log(success ? chalk.green("Success") : chalk.red("Failed"));
      if (error) console.log(chalk.red("Error:"), error);
    });
  }
}

// Process script with args
program.parse(process.argv);
