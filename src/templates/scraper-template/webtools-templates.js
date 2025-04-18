// template - cli.js
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

// template - module.js
import createBrowser from "browserless";
import { onExit } from "signal-exit";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const browser = createBrowser({ timeout: 120000 });
onExit(await browser.close);

const defaultGotoOptions = {
  device: "macbook pro 13",
  waitUntil: "auto",
  adblock: true,
};

const getGotoOptions = (options) => {
  return {
    ...defaultGotoOptions,
    ...options,
  };
};

// Core scraping function - to be implemented by each scraper
export async function scrape(url, options = {}) {
  const browserless = await browser.createContext();
  try {
    // Implement specific scraping logic here
    const result = await browserless.text(url, getGotoOptions(options));

    // Process and return results
    return processResults(result, options);
  } finally {
    await browserless.destroyContext();
  }
}

// Process results function - to be implemented by each scraper
function processResults(data, options) {
  // Implement specific result processing here
  return data;
}

// template - router.js
import express from "express";
import { scrape } from "./module.js";

const router = express.Router();

router.get("/scrape", async (req, res) => {
  const { url } = req.query;
  const options = req.query;

  try {
    const result = await scrape(url, options);
    res.json(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

export default router;
