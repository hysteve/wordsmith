import createBrowser from "browserless";
import { onExit } from "signal-exit";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const browser = createBrowser({ timeout: 120000 });
onExit(browser.close);

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

function deduplicateWords(words) {
  return [...new Set(words)];
}

const googleDotCom = "http://www.google.com";
const googleSearchInputSelector = 'form input[title="Google Search"]';
const googleQueryListboxSelector = "body > table:last-child";
const googleQueryTextSelector =
  'tr > td > div > table[role="presentation"] > tbody > tr > td > span > b';

const pause = (delay) =>
  new Promise((resolve) => setTimeout(() => resolve(), delay));

export async function extractQueryCompletions(phrase, options) {
  let phrases = [phrase];
  if (options.cascade) {
    const [a, b, ...rest] = phrase.split(" ");
    phrases = [`${a} ${b}`, ...rest.map((s) => ` ${s}`)];
  }

  const browserless = await browser.createContext();
  const extractedTexts = await browserless.evaluate(async (page) => {
    const completions = [];
    await page.setViewport({ width: 500, height: 600 });
    const searchInputHandle = await page.waitForSelector(
      googleSearchInputSelector,
      { visible: true, timeout: 4000 },
    );
    await page.evaluate(() => {
      const login = document.querySelector("iframe");
      if (login && login.remove) login.remove();
    });

    for (let nextPhrase of phrases) {
      await searchInputHandle.type(nextPhrase);
      const searchValue = await searchInputHandle.evaluate(
        (node) => node.value,
      );
      await pause(options.delay);

      const listboxHandle = await page.waitForSelector(
        googleQueryListboxSelector,
        { visible: true },
      );

      const queryCompletionResultTexts = await listboxHandle.evaluate(
        (node, selector) => {
          const resultNodes = Array.from(node.querySelectorAll(selector));
          return resultNodes.map((text) => text.textContent.trim());
        },
        googleQueryTextSelector,
      );
      await listboxHandle.dispose();

      completions.push({
        query: searchValue,
        completions: deduplicateWords(queryCompletionResultTexts),
      });

      // if (options.screenshot) {
      //   const buffer = await page.screenshot({
      //     path: path.join(__dirname, `../output/screenshot-google__${new Date().toISOString().replace(/[\W]+/g, "-")}__${searchValue.split(' ').join('-')}.png`),
      //     type: "png",
      //   });
      //   console.log(buffer);
      // }
    }

    await searchInputHandle.dispose();

    // After your task is done, destroy your browser context
    await browserless.destroyContext();

    return completions;
  }, getGotoOptions(options));

  return extractedTexts(googleDotCom);
}
