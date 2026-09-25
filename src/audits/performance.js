import createBrowser from "browserless";
import { onExit } from "signal-exit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import createLighthouse from "@browserless/lighthouse";
import { runLM, lmAvailable } from "./lm-interface.js";
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

export async function runPerformanceAudit(url, options = {}) {
  const outputDir =
    options.outputDir || path.join(process.cwd(), "audit-results");
  await fs.mkdir(outputDir, { recursive: true });
  let lighthouseReport;
  try {
    lighthouseReport = await lighthouse(url, {
      preset: options.preset || "mobile",
      onlyCategories: ["performance"],
      logLevel: options.verbose ? "info" : "error",
    });
  } catch (e) {
    return { error: `Lighthouse failed: ${e.message}` };
  }
  const scoreResult = readCategoryScore(lighthouseReport, "performance");
  if (scoreResult.error) {
    return { error: scoreResult.error };
  }
  const score = scoreResult.score;
  const metrics = {
    LCP: lighthouseReport.audits?.["largest-contentful-paint"]?.displayValue,
    FID: lighthouseReport.audits?.["max-potential-fid"]?.displayValue,
    CLS: lighthouseReport.audits?.["cumulative-layout-shift"]?.displayValue,
    TTFB: lighthouseReport.audits?.["server-response-time"]?.displayValue,
    TBT: lighthouseReport.audits?.["total-blocking-time"]?.displayValue,
  };
  const screenshotPath = path.join(outputDir, "performance-screenshot.jpg");
  const browserless = await browser.createContext();
  try {
    const screenshot = await browserless.screenshot(url, {
      type: "jpeg",
      quality: 80,
    });
    await fs.writeFile(screenshotPath, screenshot);
  } finally {
    await browserless.destroyContext();
  }
  let lmAnalysis = null;
  if (lmAvailable() && !options.skipLM) {
    lmAnalysis = await runLM(
      `Summarize the following performance audit: ${JSON.stringify(metrics)}`,
    );
  }
  return {
    auditType: "performance",
    score,
    metrics,
    recommendations: collectFailures(lighthouseReport, "performance"),
    notChecked: collectNotApplicable(lighthouseReport, "performance"),
    screenshots: [screenshotPath],
    lmAnalysis,
  };
}
