#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { scrape } from "./module.js";

// Set the args for the cli script
const program = new Command();
program
  .name("scraper")
  .description("Scrape data from a webpage")
  .argument("<url>", "The page to scrape")
  .option("-j, --json", "Print json results (default is pretty-print)")
  .option("-o, --output <file>", "Output file path")
  .option("-c, --command <command>", "Command to run on each result")
  .helpOption("-h, --help", "display help for command")
  .addHelpCommand(false)
  .showHelpAfterError(chalk.red("Add --help for additional information"))
  .action(async (url, options) => {
    try {
      const actualUrl = url.startsWith("http") ? url : `https://${url}`;
      const results = await scrape(actualUrl, options);

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

// Process script with args
program.parse(process.argv);
