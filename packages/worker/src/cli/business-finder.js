#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { businessFinder } from "@wordsmith/core/scrapers/business-finder.js";
import { writeFile, readFile } from "fs/promises";
import { table } from "table";
import ora from "ora";
import path from "path";

const program = new Command();
program
  .name("business-finder")
  .description("Find businesses using Google Maps APIs")
  .version("1.0.0");

// Search command
program
  .command("search")
  .description("Search for businesses near a location")
  .option(
    "-t, --terms <terms>",
    "Comma-separated search terms (default: food businesses)",
  )
  .option(
    "-l, --location <location>",
    "Location to search (address, zip code, town, county)",
  )
  .option("--latitude <latitude>", "Latitude coordinate")
  .option("--longitude <longitude>", "Longitude coordinate")
  .option("-r, --radius <radius>", "Search radius in meters (default: 5000)")
  .option("-d, --details", "Get detailed information for each business")
  .option(
    "-b, --batch-size <size>",
    "Number of businesses to process in each batch (default: 5)",
  )
  .option("-o, --output <file>", "Output file path")
  .action(async (options) => {
    try {
      const spinner = ora("Searching for businesses...").start();
      const results = await businessFinder("", options);
      spinner.succeed("Search completed");

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        displayResults(results);
      }

      if (options.output) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const sanitizedLocation = results.location.replace(
          /[^a-zA-Z0-9]/g,
          "_",
        );
        const filename =
          options.output || `businesses_${sanitizedLocation}_${timestamp}.json`;
        await writeFile(filename, JSON.stringify(results, null, 2));
        console.log(chalk.green(`Results saved to ${filename}`));
      }

      process.exit();
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Details command
program
  .command("details <jsonFile>")
  .description("Get detailed information for businesses from a JSON file")
  .option(
    "-b, --batch-size <size>",
    "Number of businesses to process in each batch (default: 5)",
  )
  .option("-o, --output <file>", "Output file path")
  .option("-m, --limit <count>", "Limit number of items processed")
  .action(async (jsonFile, options) => {
    try {
      const spinner = ora("Getting business details...").start();
      const data = JSON.parse(await readFile(jsonFile, "utf8"));

      if (!data.results || !Array.isArray(data.results)) {
        throw new Error("Invalid business data file");
      }

      const results = await businessFinder("", {
        ...options,
        getDetails: true,
        results: data.results,
      });

      spinner.succeed("Details retrieved");

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        displayResults(results);
      }

      if (options.output) {
        const inputFileName = path.basename(jsonFile, ".json");
        const outputFileName =
          options.output || `details_${inputFileName}.json`;
        await writeFile(outputFileName, JSON.stringify(results, null, 2));
        console.log(chalk.green(`Results saved to ${outputFileName}`));
      }

      process.exit();
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

function displayResults(results) {
  if (results.results.length === 0) {
    console.log(chalk.yellow("No businesses found."));
    return;
  }

  const tableData = [["#", "Name", "Address", "Rating", "Distance (km)"]];

  results.results.forEach((business, index) => {
    tableData.push([
      (index + 1).toString(),
      chalk.green(business.name),
      business.address || business.vicinity,
      business.rating
        ? `${business.rating} ⭐ (${business.user_ratings_total})`
        : "N/A",
      business.distance ? business.distance.toFixed(2) : "N/A",
    ]);
  });

  console.log(chalk.cyan(`\nSearch results for ${results.location}:`));
  console.log(chalk.gray(`Total results: ${results.totalResults}\n`));
  console.log(table(tableData));
}

program.parse(process.argv);
