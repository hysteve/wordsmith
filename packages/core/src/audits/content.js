import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { runLM, lmAvailable } from "./lm-interface.js";
import { gotoOptions } from "./goto-options.js";
import { browser } from "../adapters/browser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runContentAudit(url, options = {}) {
  const outputDir =
    options.outputDir || path.join(process.cwd(), "audit-results");
  await fs.mkdir(outputDir, { recursive: true });
  const browserless = await browser.createContext();
  let content = {};
  try {
    const extractContent = await browserless.evaluate(
      async (page) =>
        page.evaluate(() => {
          const main = document.querySelector("main") || document.body;
          return {
            wordCount: main.innerText.split(/\s+/).length,
            headings: Array.from(main.querySelectorAll("h1, h2, h3")).map(
              (h) => h.innerText,
            ),
            images: main.querySelectorAll("img").length,
            links: main.querySelectorAll("a").length,
          };
        }),
      gotoOptions(),
    );
    content = await extractContent(url);
  } finally {
    await browserless.destroyContext();
  }
  const screenshotPath = path.join(outputDir, "content-screenshot.jpg");
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
      `Summarize the following content audit: ${JSON.stringify(content)}`,
    );
  }
  return {
    auditType: "content",
    content,
    screenshots: [screenshotPath],
    lmAnalysis,
  };
}
