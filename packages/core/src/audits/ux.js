import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { runLM, lmAvailable } from "./lm-interface.js";
import { gotoOptions } from "./goto-options.js";
import { browser } from "../adapters/browser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runUXAudit(url, options = {}) {
  const outputDir =
    options.outputDir || path.join(process.cwd(), "audit-results");
  await fs.mkdir(outputDir, { recursive: true });
  const browserless = await browser.createContext();
  let ux = {};
  try {
    const extractUx = await browserless.evaluate(
      async (page) =>
        page.evaluate(() => {
          return {
            navLinks: document.querySelectorAll("nav a").length,
            ctas: document.querySelectorAll("button, a.btn, .cta").length,
            mobileMeta: !!document.querySelector('meta[name="viewport"]'),
          };
        }),
      gotoOptions(),
    );
    ux = await extractUx(url);
  } finally {
    await browserless.destroyContext();
  }
  const screenshotPath = path.join(outputDir, "ux-screenshot.jpg");
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
      `Summarize the following UX audit: ${JSON.stringify(ux)}`,
    );
  }
  return {
    auditType: "ux",
    ux,
    screenshots: [screenshotPath],
    lmAnalysis,
  };
}
