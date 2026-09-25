import createBrowser from "browserless";
import { onExit } from "signal-exit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import createLighthouse from "@browserless/lighthouse";
import { runLM, lmAvailable } from "./lm-interface.js";
import { gotoOptions } from "./goto-options.js";
import {
  collectFailures,
  collectNotApplicable,
  readCategoryScore,
} from "./lighthouse-report.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const browser = createBrowser({ timeout: 120000 });
onExit(async () => await browser.close());

const lighthouse = createLighthouse(async (teardown) => {
  const browserless = await browser.createContext();
  teardown(() => browserless.destroyContext());
  return browserless;
});

export async function runSEOAudit(url, options = {}) {
  const outputDir =
    options.outputDir || path.join(process.cwd(), "audit-results");
  await fs.mkdir(outputDir, { recursive: true });
  let lighthouseReport;
  try {
    lighthouseReport = await lighthouse(url, {
      preset: "mobile",
      onlyCategories: ["seo"],
      logLevel: options.verbose ? "info" : "error",
    });
  } catch (e) {
    return { error: `Lighthouse failed: ${e.message}` };
  }
  const scoreResult = readCategoryScore(lighthouseReport, "seo");
  if (scoreResult.error) {
    return { error: scoreResult.error };
  }
  const score = scoreResult.score;
  const browserless = await browser.createContext();
  let meta = {};
  try {
    const extractMeta = await browserless.evaluate(
      async (page) =>
        page.evaluate(() => {
          return {
            title: document.title,
            description: document.querySelector('meta[name="description"]')
              ?.content,
            canonical: document.querySelector('link[rel="canonical"]')?.href,
            h1: document.querySelectorAll("h1").length,
            h2: document.querySelectorAll("h2").length,
            images: document.querySelectorAll("img").length,
            imagesWithoutAlt: Array.from(
              document.querySelectorAll("img"),
            ).filter((img) => !img.alt).length,
          };
        }),
      gotoOptions(),
    );
    meta = await extractMeta(url);
  } finally {
    await browserless.destroyContext();
  }
  const screenshotPath = path.join(outputDir, "seo-screenshot.jpg");
  const browserless2 = await browser.createContext();
  try {
    const screenshot = await browserless2.screenshot(url, {
      type: "jpeg",
      quality: 80,
    });
    await fs.writeFile(screenshotPath, screenshot);
  } finally {
    await browserless2.destroyContext();
  }
  let lmAnalysis = null;
  if (lmAvailable() && !options.skipLM) {
    lmAnalysis = await runLM(
      `Summarize the following SEO audit: ${JSON.stringify(meta)}`,
    );
  }
  return {
    auditType: "seo",
    score,
    meta,
    recommendations: collectFailures(lighthouseReport, "seo"),
    notChecked: collectNotApplicable(lighthouseReport, "seo"),
    screenshots: [screenshotPath],
    lmAnalysis,
  };
}
