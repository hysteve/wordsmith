import path from "path";
import { fileURLToPath } from "url";
import { browser } from "../../adapters/browser.js";

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
