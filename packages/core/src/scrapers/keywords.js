import { stopWords } from "../data/common-words.js";
import path from "path";
import { fileURLToPath } from "url";
import { browser } from "../adapters/browser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

/**
 * Word, pair and triplet counts for a page's visible text.
 *
 * The bare-hostname handling used to live in the CLI, so `keywords` accepted
 * "example.com" but the HTTP route did not. It belongs here.
 */
export async function parseKeywords(url, options = {}) {
  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const browserless = await browser.createContext();
  try {
    const pageText = await browserless.text(target, getGotoOptions(options));
    return parse(pageText, options.minCount ?? 2);
  } finally {
    await browserless.destroyContext();
  }
}
