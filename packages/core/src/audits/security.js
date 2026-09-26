import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { runLM, lmAvailable } from "./lm-interface.js";
import { browser } from "../adapters/browser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runSecurityAudit(url, options = {}) {
  const outputDir =
    options.outputDir || path.join(process.cwd(), "audit-results");
  await fs.mkdir(outputDir, { recursive: true });
  let security = {};
  try {
    const response = await fetch(url);
    const headers = response.headers;
    security = {
      ssl: url.startsWith("https://"),
      csp: headers.get("content-security-policy"),
      hsts: headers.get("strict-transport-security"),
      xfo: headers.get("x-frame-options"),
      xcto: headers.get("x-content-type-options"),
      referrer: headers.get("referrer-policy"),
    };
  } catch (e) {
    return { error: `Failed to fetch headers: ${e.message}` };
  }
  const screenshotPath = path.join(outputDir, "security-screenshot.jpg");
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
      `Summarize the following security audit: ${JSON.stringify(security)}`,
    );
  }
  return {
    auditType: "security",
    security,
    screenshots: [screenshotPath],
    lmAnalysis,
  };
}
