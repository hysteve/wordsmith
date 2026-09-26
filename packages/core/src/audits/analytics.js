import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { runLM, lmAvailable } from "./lm-interface.js";
import { gotoOptions } from "./goto-options.js";
import { browser } from "../adapters/browser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runAnalyticsAudit(url, options = {}) {
  const outputDir =
    options.outputDir || path.join(process.cwd(), "audit-results");
  await fs.mkdir(outputDir, { recursive: true });
  const browserless = await browser.createContext();
  let analytics = {};
  try {
    const extractAnalytics = await browserless.evaluate(
      async (page) =>
        page.evaluate(() => {
          const scripts = Array.from(document.scripts);
          const srcs = scripts.map((s) => s.src).filter(Boolean);
          const inline = scripts
            .filter((s) => !s.src)
            .map((s) => s.textContent || "")
            .join("\n");
          const all = srcs.join("\n") + "\n" + inline;
          // A tag can be injected by a manager or a proxy, so the runtime globals
          // are the most reliable signal that a tracker actually loaded.
          const hasGlobal = (name) => typeof window[name] !== "undefined";

          const ga4Ids = [...new Set(all.match(/\bG-[A-Z0-9]{6,}\b/g) || [])];
          const uaIds = [...new Set(all.match(/\bUA-\d{4,}-\d+\b/g) || [])];
          const gtmIds = [...new Set(all.match(/\bGTM-[A-Z0-9]{4,}\b/g) || [])];

          const googleAnalytics = {
            detected:
              ga4Ids.length > 0 ||
              uaIds.length > 0 ||
              hasGlobal("gtag") ||
              hasGlobal("ga") ||
              srcs.some((s) => s.includes("googletagmanager.com/gtag/js")) ||
              all.includes("google-analytics.com/analytics.js"),
            version: null,
            ids: [...ga4Ids, ...uaIds],
          };
          if (ga4Ids.length || srcs.some((s) => s.includes("gtag/js"))) {
            googleAnalytics.version = "GA4";
          } else if (uaIds.length || all.includes("analytics.js")) {
            googleAnalytics.version = "Universal Analytics (deprecated)";
          } else if (all.includes("google-analytics.com/ga.js")) {
            googleAnalytics.version = "Classic (deprecated)";
          }

          const googleTagManager = {
            detected:
              gtmIds.length > 0 ||
              srcs.some((s) => s.includes("googletagmanager.com/gtm.js")),
            ids: gtmIds,
            dataLayerPresent: Array.isArray(window.dataLayer),
            dataLayerEvents: Array.isArray(window.dataLayer)
              ? [
                  ...new Set(
                    window.dataLayer
                      .map((e) => (e && (e.event || e[0])) || null)
                      .filter((e) => typeof e === "string"),
                  ),
                ].slice(0, 25)
              : [],
          };

          const facebookPixel = {
            detected:
              hasGlobal("fbq") ||
              all.includes("connect.facebook.net") ||
              all.includes("facebook.com/tr"),
            ids: [
              ...new Set(
                (
                  all.match(/fbq\(\s*['"]init['"]\s*,\s*['"](\d{6,})['"]/g) ||
                  []
                )
                  .map((m) => m.match(/(\d{6,})/)?.[1])
                  .filter(Boolean),
              ),
            ],
          };

          const TRACKERS = [
            ["Google Ads", /googleadservices\.com|google\.com\/ads|AW-\d+/],
            ["Hotjar", /hotjar\.com/],
            ["Clarity", /clarity\.ms/],
            ["Mixpanel", /mixpanel\.com/],
            ["Segment", /cdn\.segment\.(com|io)/],
            ["Amplitude", /amplitude\.com/],
            ["Heap", /heap(analytics)?\.(io|com)/],
            ["FullStory", /fullstory\.com/],
            ["LinkedIn Insight", /snap\.licdn\.com|linkedin\.com\/insight/],
            ["TikTok Pixel", /analytics\.tiktok\.com/],
            ["Twitter/X Pixel", /static\.ads-twitter\.com/],
            ["Pinterest Tag", /pintrk|ct\.pinterest\.com/],
            ["Reddit Pixel", /redditstatic\.com\/ads/],
            ["Snap Pixel", /sc-static\.net\/scevent/],
            ["HubSpot", /js\.hs-(scripts|analytics)\.com|hubspot\.com/],
            ["Intercom", /intercom\.(io|com)/],
            ["Drift", /drift\.com/],
            ["Klaviyo", /klaviyo\.com/],
            ["Crazy Egg", /crazyegg\.com/],
            ["Matomo", /matomo|piwik/],
            ["Plausible", /plausible\.io/],
            ["Fathom", /usefathom\.com/],
            ["Cloudflare Insights", /cloudflareinsights\.com/],
          ];
          const otherTrackers = TRACKERS.filter(([, re]) => re.test(all)).map(
            ([name]) => name,
          );

          // Named CMP vendors first; a generic banner is a weaker, separate signal.
          const CMPS = [
            ["Cookiebot", /cookiebot\.com/],
            ["OneTrust", /onetrust\.com|otSDKStub/],
            ["TrustArc", /trustarc\.com/],
            ["Osano", /osano\.com/],
            ["Usercentrics", /usercentrics\.(eu|com)/],
            ["Klaro", /klaro/],
            ["CookieYes", /cookieyes\.com/],
            ["Complianz", /complianz/],
            ["Termly", /termly\.io/],
            [
              "Quantcast Choice",
              /quantcast\.mgr\.consensu\.org|cmp\.quantcast/,
            ],
          ];
          const cmp = CMPS.find(([, re]) => re.test(all));

          const bannerEl = document.querySelector(
            '[id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i], [id*="gdpr" i], [class*="gdpr" i], [aria-label*="cookie" i]',
          );
          const bannerVisible = !!(
            bannerEl &&
            bannerEl.getBoundingClientRect().height > 0 &&
            getComputedStyle(bannerEl).visibility !== "hidden"
          );

          const consent = {
            cmp: cmp ? cmp[0] : null,
            bannerDetected: !!bannerEl,
            bannerVisible,
            // Google Consent Mode leaves a `consent` call in the dataLayer.
            consentModeV2: /gtag\(\s*['"]consent['"]/.test(all),
          };

          return {
            googleAnalytics,
            googleTagManager,
            facebookPixel,
            otherTrackers,
            consent,
            scriptCounts: { total: scripts.length, external: srcs.length },
          };
        }),
      gotoOptions(),
    );
    analytics = await extractAnalytics(url);
  } finally {
    await browserless.destroyContext();
  }
  const screenshotPath = path.join(outputDir, "analytics-screenshot.jpg");
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
      `Summarize the following analytics audit: ${JSON.stringify(analytics)}`,
    );
  }
  return {
    auditType: "analytics",
    analytics,
    screenshots: [screenshotPath],
    lmAnalysis,
  };
}
