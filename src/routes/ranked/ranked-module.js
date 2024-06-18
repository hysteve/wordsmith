import createBrowser from "browserless";
import { onExit } from "signal-exit";
import path from "path";
import { fileURLToPath } from "url";
import { createContext } from "vm";

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

const getGoogleSearchUrl = (query, options) => {
  const queryParam = query ? escape(query.replace(/\s/g, "+")) : "";
  const link = options.linkbacks
    ? `link%3A${options.linkbacks}+-site%3A${options.linkbacks}`
    : "";
  if (!queryParam && !link) {
    throw new Error("There is no search query or site link query set");
  }
  const excludes = [].concat(options.exclude).map((s) => `-site%3A${s}`);
  return `https://google.com/search?q=${[link || queryParam].concat(excludes).join("+")}`;
};

export async function extractQueryRankings(searchQuery, options) {
  const browserless = await browser.createContext();
  const extractedTexts = await browserless.evaluate(async (page) => {
    await page.setViewport({ width: 1920 / 2, height: 1080 * 2 });
    if (options.screenshot) {
      const buffer = await page.screenshot({
        path: path.join(
          __dirname,
          `../output/screenshot_${new Date().toISOString().replace(/[\W]+/g, "-")}.png`,
        ),
        type: "png",
      });
      console.log(buffer);
    }

    const allResultUrls = await page.evaluate(() => {
      const getUrlAttribute = (href) => {
        const innerUrlRegex = /(?:url=)(https?.*?)(&|$)/;
        const matches = href.match(innerUrlRegex);
        return matches && matches[1] ? matches[1] : null;
      };
      const urls = Array.from(document.querySelectorAll("a[href][data-ved]"));

      return urls
        .map((url) => ({
          url: getUrlAttribute(url.getAttribute("href")),
          title: url.querySelector("h3")
            ? url.querySelector("h3").textContent
            : null,
        }))
        .filter(({ url, title }) => !!url && !!title);
    });
    return allResultUrls;
  }, getGotoOptions(options));

  const mainUrl = getGoogleSearchUrl(searchQuery, options);
  let pages = options.pages;
  let results = [];

  while (pages > 0) {
    pages--;
    const url = results.length ? mainUrl + `&start=${results.length}` : mainUrl;
    const resultData = await extractedTexts(url);
    results.push(
      ...resultData.map((url, i) => ({ ...url, rank: results.length + i + 1 })),
    );
  }

  return results;
}
