import createBrowser from "browserless";
import { onExit } from "signal-exit";
import { stopWords } from "../../data/common-words.js";
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
  };
};

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

export async function parseKeywords(url, options) {
  const browserless = await browser.createContext();
  const pageText = await browserless.text(url, getGotoOptions(options));
  return parse(pageText, options.minCount);
}