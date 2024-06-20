#!/usr/bin/env node
import createBrowser from "browserless";
import { Command } from "commander";
import chalk from "chalk";
import { onExit } from "signal-exit";
import termImg from "term-img";
import { stopWords } from "../data/common-words.js";
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

function parse(html, minCount) {
  var words = html.split(/\W+/);
  var wordCounts = {};
  var wordPairs = {};
  var wordTriplets = {};

  for (var i = 0; i < words.length; i++) {
    var word = words[i].toLowerCase();
    if (word.length > 2 && !stopWords.includes(word)) {
      if (wordCounts[word]) {
        wordCounts[word]++;
      } else {
        wordCounts[word] = 1;
      }
      if (i < words.length - 1) {
        var pair = word + " " + words[i + 1].toLowerCase();
        if (wordPairs[pair]) {
          wordPairs[pair]++;
        } else {
          wordPairs[pair] = 1;
        }
      }
      if (i < words.length - 2) {
        var triplet =
          word +
          " " +
          words[i + 1].toLowerCase() +
          " " +
          words[i + 2].toLowerCase();
        if (wordTriplets[triplet]) {
          wordTriplets[triplet]++;
        } else {
          wordTriplets[triplet] = 1;
        }
      }
    }
  }

  var wordCountsArray = [];
  for (var word in wordCounts) {
    wordCountsArray.push([word, wordCounts[word]]);
  }
  wordCountsArray.sort(function (a, b) {
    return b[1] - a[1];
  });

  var wordPairsArray = [];
  for (var pair in wordPairs) {
    wordPairsArray.push([pair, wordPairs[pair]]);
  }
  wordPairsArray.sort(function (a, b) {
    return b[1] - a[1];
  });

  var wordTripletsArray = [];
  for (var triplet in wordTriplets) {
    wordTripletsArray.push([triplet, wordTriplets[triplet]]);
  }
  wordTripletsArray.sort(function (a, b) {
    return b[1] - a[1];
  });

  return {
    words: wordCountsArray.filter(([word, count]) => count >= minCount),
    pairs: wordPairsArray.filter(([word, count]) => count >= minCount),
    triplets: wordTripletsArray.filter(([word, count]) => count >= minCount),
  };
}

async function parseKeywords(browserless, url, options) {
  const pageText = await browserless.text(url, getGotoOptions(options));
  console.log(pageText)
  return parse(pageText, options.minCount);
}

function prettyPrint(url, options, result) {
  console.log(chalk.gray("Keywords for"), chalk.white(url));
  console.log("Word counts:", result.words);
  console.log("Word pairs:", result.pairs);
  console.log("Word triplets:", result.triplets);
}

// Set the args for the cli script
const program = new Command();
program
  .name("keywords")
  .description("Get keywords from a webpage")
  .argument("<url>", "The page to get keywords from")
  .option("-j, --json", "Print json results (default is pretty-print)")
  .option("-s, --screenshot", "Get screenshot of the results")
  .option("-m, --minCount <ninCount>", "Only include words found more than N times", 2)
  .helpOption("-h, --help", "display help for command")
  .addHelpCommand(false) // disables default help command
  .showHelpAfterError(chalk.red("Add --help for additional information"))
  .action(async (url, options) => {
    try {
      // Browser contexts are like browser tabs
      // You can create as many as your resources can support
      // Cookies/caches are limited to their respective browser contexts, just like browser tabs
      const browserless = await browser.createContext();

      const actualUrl = url.startsWith('http') ? url : `https://${url}`;

      console.log(options.minCount)
      const queryResults = await parseKeywords(browserless, actualUrl, options);

      /**
       * Log Result Synonyms
       */
      if (!options.json) prettyPrint(url, options, queryResults);
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
