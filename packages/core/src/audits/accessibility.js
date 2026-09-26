import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import createLighthouse from "@browserless/lighthouse";
import { runLM, lmAvailable } from "./lm-interface.js";
import { gotoOptions } from "./goto-options.js";
import { browser } from "../adapters/browser.js";
import {
  collectFailures,
  collectNotApplicable,
  getAudit,
  readCategoryScore,
} from "./lighthouse-report.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const lighthouse = createLighthouse(async (teardown) => {
  const browserless = await browser.createContext();
  teardown(() => browserless.destroyContext());
  return browserless;
});

export async function runAccessibilityAudit(url, options = {}) {
  const outputDir =
    options.outputDir || path.join(process.cwd(), "audit-results");
  await fs.mkdir(outputDir, { recursive: true });
  let lighthouseReport;
  try {
    lighthouseReport = await lighthouse(url, {
      preset: "mobile",
      onlyCategories: ["accessibility"],
      logLevel: options.verbose ? "info" : "error",
    });
  } catch (e) {
    return { error: `Lighthouse failed: ${e.message}` };
  }
  const scoreResult = readCategoryScore(lighthouseReport, "accessibility");
  if (scoreResult.error) {
    return { error: scoreResult.error };
  }
  const score = scoreResult.score;
  const browserless = await browser.createContext();
  let a11y = {};
  try {
    const extractA11y = await browserless.evaluate(
      async (page) =>
        page.evaluate(() => {
          // Note: color contrast is NOT checked here. Computing a real WCAG
          // contrast ratio needs the resolved background behind each text node
          // (inherited, layered, gradients, images), which this context cannot
          // do reliably. Lighthouse bundles axe-core, which does it properly —
          // that result is attached as `contrast` from the report instead.
          const images = Array.from(document.querySelectorAll("img"));
          const decorative = images.filter(
            (img) =>
              img.getAttribute("alt") === "" || img.ariaHidden === "true",
          );
          const missingAlt = images.filter((img) => !img.hasAttribute("alt"));

          // A label counts when it is associated, not merely present.
          const fields = Array.from(
            document.querySelectorAll(
              'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea',
            ),
          );
          const unlabelled = fields.filter((f) => {
            if (f.getAttribute("aria-label")?.trim()) return false;
            if (f.getAttribute("aria-labelledby")) {
              const ids = f.getAttribute("aria-labelledby").split(/\s+/);
              if (ids.some((id) => document.getElementById(id))) return false;
            }
            if (
              f.id &&
              document.querySelector(`label[for="${CSS.escape(f.id)}"]`)
            )
              return false;
            if (f.closest("label")) return false;
            if (f.getAttribute("title")?.trim()) return false;
            return true;
          });

          const skipLinkEls = Array.from(
            document.querySelectorAll('a[href^="#"]:not([href="#"])'),
          );
          // A skip link only helps if it targets something and says so.
          const realSkipLinks = skipLinkEls.filter((a) => {
            const label = (a.innerText || a.textContent || "").toLowerCase();
            const target = document.getElementById(
              decodeURIComponent(a.getAttribute("href").slice(1)),
            );
            return !!target && /skip|jump|main content/.test(label);
          });

          // Positive tabindex is an anti-pattern: it breaks DOM focus order.
          const positiveTabindex = Array.from(
            document.querySelectorAll("[tabindex]"),
          ).filter((el) => Number(el.getAttribute("tabindex")) > 0);

          // Interactive elements with no accessible name at all.
          const namelessControls = Array.from(
            document.querySelectorAll('a, button, [role="button"]'),
          ).filter((el) => {
            const name =
              (el.innerText || el.textContent || "").trim() ||
              el.getAttribute("aria-label")?.trim() ||
              el.querySelector("img[alt]")?.getAttribute("alt")?.trim() ||
              el.getAttribute("title")?.trim();
            return !name;
          });

          return {
            images: {
              total: images.length,
              missingAlt: missingAlt.length,
              decorative: decorative.length,
            },
            forms: {
              fields: fields.length,
              unlabelled: unlabelled.length,
              unlabelledSamples: unlabelled
                .slice(0, 5)
                .map((f) => f.name || f.id || f.type || f.tagName),
            },
            keyboard: {
              focusableElements: document.querySelectorAll(
                'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
              ).length,
              positiveTabindex: positiveTabindex.length,
              anchorSkipLinks: skipLinkEls.length,
              workingSkipLinks: realSkipLinks.length,
            },
            aria: {
              annotatedElements: document.querySelectorAll(
                "[aria-label], [aria-labelledby], [aria-describedby], [role]",
              ).length,
              landmarks: document.querySelectorAll(
                'main, nav, header, footer, aside, [role="main"], [role="navigation"], [role="banner"], [role="contentinfo"]',
              ).length,
              hasMainLandmark: !!document.querySelector('main, [role="main"]'),
              namelessControls: namelessControls.length,
            },
            language: {
              htmlLang: document.documentElement.getAttribute("lang") || null,
            },
          };
        }),
      gotoOptions(),
    );
    a11y = await extractA11y(url);
  } finally {
    await browserless.destroyContext();
  }

  // Real WCAG contrast, from the axe-core run inside Lighthouse.
  const contrastAudit = getAudit(lighthouseReport, "color-contrast");
  a11y.contrast = contrastAudit
    ? {
        checked: contrastAudit.score !== null,
        passed: contrastAudit.score === 1,
        failingElements: contrastAudit.details?.items?.length || 0,
        samples: (contrastAudit.details?.items || [])
          .slice(0, 5)
          .map((item) => ({
            selector: item.node?.selector || null,
            snippet: item.node?.snippet?.slice(0, 160) || null,
            explanation: item.node?.explanation || null,
          })),
      }
    : { checked: false, reason: "color-contrast audit absent from report" };
  const screenshotPath = path.join(outputDir, "accessibility-screenshot.jpg");
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
      `Summarize the following accessibility audit: ${JSON.stringify(a11y)}`,
    );
  }
  return {
    auditType: "accessibility",
    score,
    a11y,
    recommendations: collectFailures(lighthouseReport, "accessibility"),
    notChecked: collectNotApplicable(lighthouseReport, "accessibility"),
    screenshots: [screenshotPath],
    lmAnalysis,
  };
}
