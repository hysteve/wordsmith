#!/usr/bin/env node

import { crawlSite } from "../api/sitemap/sitemap-module.js";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import CLI libraries
import { program } from "commander";
import ora from "ora";
import chalk from "chalk";
import figlet from "figlet";
import Table from "cli-table3";

const execAsync = promisify(exec);

/**
 * Run a shell command against a crawled URL.
 *
 * This lives in the CLI and not in the sitemap module on purpose. It used to
 * be exported from the module, and the HTTP router passed `req.query.command`
 * straight into it — remote code execution for anyone who could reach the
 * route. Keeping it here makes that impossible to wire up by accident: the
 * capability belongs to someone already running commands on this machine.
 */
async function executeCommand(command, url) {
  if (!command) return null;
  try {
    const { stdout, stderr } = await execAsync(command.replace("{url}", url));
    return { url, stdout, stderr };
  } catch (error) {
    return { url, error: error.message };
  }
}

// Display banner
console.log(
  chalk.blue(figlet.textSync("LinkTracer", { horizontalLayout: "full" })),
);

// Configure the CLI
program
  .name("linktracer")
  .description(
    "Extract and categorize links from websites using browser automation",
  )
  .version("1.0.0")
  .argument("<url>", "URL to crawl (with or without http/https)")
  .option(
    "-m, --max-pages <number>",
    "Maximum number of pages to crawl",
    (val) => parseInt(val, 10),
    10,
  )
  .option(
    "-d, --max-depth <number>",
    "Maximum depth to crawl",
    (val) => parseInt(val, 10),
    2,
  )
  .option("-e, --include-external", "Follow external links", false)
  .option(
    "-c, --command <command>",
    "Run command for each URL (use {url} as placeholder)",
  )
  .option("-o, --output <file>", "Save results to JSON file")
  .option("-v, --verbose", "Show verbose output")
  .option("-s, --summary", "Show only summary statistics", false)
  .action(async (url, options) => {
    // Start the spinner
    const spinner = ora("Initializing crawler...").start();

    try {
      // Format URL if needed
      const targetUrl = url.startsWith("http") ? url : `https://${url}`;

      spinner.text = `Crawling ${chalk.cyan(targetUrl)}`;

      // Setup crawl options
      const crawlOptions = {
        maxPages: options.maxPages,
        maxDepth: options.maxDepth,
        includeExternal: options.includeExternal,
        onProgress: (current, total, url) => {
          spinner.text = `Crawling page ${chalk.yellow(current)}/${chalk.yellow(total)}: ${chalk.cyan(url)}`;
        },
      };

      // Run the crawler
      const results = await crawlSite(targetUrl, crawlOptions);

      // Run commands if specified
      if (options.command) {
        spinner.text = "Executing commands on URLs...";

        const targetUrls = [
          ...results.internal.map((link) => link.url),
          ...(options.includeExternal
            ? results.external.map((link) => link.url)
            : []),
        ].slice(0, 100); // Limit to 100 to avoid too many processes

        const commandResults = await Promise.all(
          targetUrls.map((url) => executeCommand(options.command, url)),
        );

        results.commandResults = commandResults;
      }

      // Complete the crawl
      spinner.succeed(
        `Crawl complete! Found ${chalk.green(results.totalLinks)} links on ${chalk.green(results.totalCrawled)} pages.`,
      );

      // Display results
      if (options.summary) {
        displaySummary(results);
      } else {
        displayResults(results, options.verbose);
      }

      // Save results if requested
      if (options.output) {
        await fs.writeFile(
          options.output,
          JSON.stringify(results, null, 2),
          "utf8",
        );
        console.log(chalk.green(`\nResults saved to ${options.output}`));
      }

      // The browserless Chrome process keeps the event loop alive, so without
      // this the CLI prints its results and then hangs forever. Matches how
      // ranked/keywords/syn/googled end.
      process.exit(0);
    } catch (error) {
      spinner.fail(chalk.red("Crawl failed!"));
      console.error(chalk.red(`\nError: ${error.message}`));
      process.exit(1);
    }
  });

// Function to display summary results
function displaySummary(results) {
  console.log(chalk.bold("\n📊 CRAWL SUMMARY\n"));

  const table = new Table({
    head: [chalk.cyan("Metric"), chalk.cyan("Value")],
    colWidths: [20, 50],
  });

  table.push(
    ["Base URL", results.baseUrl],
    ["Pages Crawled", results.totalCrawled],
    ["Total Links", results.totalLinks],
    ["Internal Links", results.internal.length],
    ["Navigation Links", results.navigation.length],
    ["External Links", results.external.length],
    ["Other Links", results.other.length],
  );

  console.log(table.toString());
}

// Function to display detailed results
function displayResults(results, verbose) {
  displaySummary(results);

  if (verbose) {
    // Display internal links
    if (results.internal.length > 0) {
      console.log(chalk.green("\n🔗 INTERNAL LINKS\n"));

      const internalTable = new Table({
        head: [chalk.cyan("#"), chalk.cyan("URL"), chalk.cyan("Text")],
        colWidths: [5, 50, 25],
        wordWrap: true,
      });

      results.internal.slice(0, 15).forEach((link, i) => {
        internalTable.push([
          i + 1,
          link.url.substring(0, 48),
          link.text ? link.text.substring(0, 23) : "",
        ]);
      });

      console.log(internalTable.toString());

      if (results.internal.length > 15) {
        console.log(
          chalk.yellow(
            `...and ${results.internal.length - 15} more internal links`,
          ),
        );
      }
    }

    // Display navigation links
    if (results.navigation.length > 0) {
      console.log(chalk.yellow("\n🧭 NAVIGATION LINKS\n"));

      const navTable = new Table({
        head: [chalk.cyan("#"), chalk.cyan("URL"), chalk.cyan("Text")],
        colWidths: [5, 50, 25],
        wordWrap: true,
      });

      results.navigation.forEach((link, i) => {
        navTable.push([
          i + 1,
          link.url.substring(0, 48),
          link.text ? link.text.substring(0, 23) : "",
        ]);
      });

      console.log(navTable.toString());
    }

    // Display external links (sample)
    if (results.external.length > 0) {
      console.log(chalk.red("\n🌐 EXTERNAL LINKS (SAMPLE)\n"));

      const externalTable = new Table({
        head: [chalk.cyan("#"), chalk.cyan("URL"), chalk.cyan("Text")],
        colWidths: [5, 50, 25],
        wordWrap: true,
      });

      results.external.slice(0, 10).forEach((link, i) => {
        externalTable.push([
          i + 1,
          link.url.substring(0, 48),
          link.text ? link.text.substring(0, 23) : "",
        ]);
      });

      console.log(externalTable.toString());

      if (results.external.length > 10) {
        console.log(
          chalk.yellow(
            `...and ${results.external.length - 10} more external links`,
          ),
        );
      }
    }

    // Display command results if available
    if (results.commandResults && results.commandResults.length > 0) {
      console.log(chalk.blue("\n🔧 COMMAND RESULTS (SAMPLE)\n"));

      const cmdTable = new Table({
        head: [chalk.cyan("#"), chalk.cyan("URL"), chalk.cyan("Result")],
        colWidths: [5, 30, 45],
        wordWrap: true,
      });

      results.commandResults.slice(0, 5).forEach((result, i) => {
        cmdTable.push([
          i + 1,
          result.url.substring(0, 28),
          result.stdout
            ? result.stdout.substring(0, 43)
            : result.error
              ? `Error: ${result.error.substring(0, 38)}`
              : "",
        ]);
      });

      console.log(cmdTable.toString());

      if (results.commandResults.length > 5) {
        console.log(
          chalk.yellow(
            `...and ${results.commandResults.length - 5} more command results`,
          ),
        );
      }
    }
  } else {
    console.log(chalk.yellow("\nUse --verbose for detailed link information"));
  }
}

// Parse command line arguments
program.parse();
