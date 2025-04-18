// module.js - Core Auditing Module
import createBrowser from "browserless";
import { onExit } from "signal-exit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import createLighthouse from "@browserless/lighthouse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create browser instance with increased timeout
const browser = createBrowser({ timeout: 180000 });
onExit(async () => await browser.close());

// Default options for browser navigation
const defaultGotoOptions = {
  device: "macbook pro 13",
  waitUntil: "networkidle2",
  adblock: true,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36",
  },
};

// Combine default options with user-provided options
const getGotoOptions = (options) => {
  return {
    ...defaultGotoOptions,
    ...options,
  };
};

// Initialize Lighthouse
const lighthouse = createLighthouse(async (teardown) => {
  const browserless = await browser.createContext();
  teardown(() => browserless.destroyContext());
  return browserless;
});

// Take a screenshot of the page
export async function captureScreenshot(url, outputPath, options = {}) {
  const browserless = await browser.createContext();
  try {
    const screenshot = await browserless.screenshot(url, {
      ...getGotoOptions(options),
      type: "jpeg",
      quality: 80,
    });

    await fs.writeFile(outputPath, screenshot);
    return outputPath;
  } finally {
    await browserless.destroyContext();
  }
}

// Run a full audit on a URL
export async function runFullAudit(url, options = {}) {
  const results = {
    url,
    timestamp: new Date().toISOString(),
    audits: {},
  };

  // Create output directory for screenshots and reports
  const outputDir =
    options.outputDir ||
    path.join(
      process.cwd(),
      "audit-results",
      new URL(url).hostname,
      new Date().toISOString().replace(/[:.]/g, "-"),
    );
  await fs.mkdir(outputDir, { recursive: true });

  // Run each audit type based on options
  const auditTypes = options.auditTypes || [
    "performance",
    "seo",
    "accessibility",
    "ux",
    "content",
    "security",
    "analytics",
    "business",
    "reputation",
  ];

  // For each audit type, run the corresponding audit function
  for (const auditType of auditTypes) {
    try {
      switch (auditType) {
        case "performance":
          results.audits.performance = await runPerformanceAudit(url, {
            ...options,
            outputDir,
          });
          break;
        case "seo":
          results.audits.seo = await runSEOAudit(url, {
            ...options,
            outputDir,
          });
          break;
        case "accessibility":
          results.audits.accessibility = await runAccessibilityAudit(url, {
            ...options,
            outputDir,
          });
          break;
        case "ux":
          results.audits.ux = await runUXAudit(url, { ...options, outputDir });
          break;
        case "content":
          results.audits.content = await runContentAudit(url, {
            ...options,
            outputDir,
          });
          break;
        case "security":
          results.audits.security = await runSecurityAudit(url, {
            ...options,
            outputDir,
          });
          break;
        case "analytics":
          results.audits.analytics = await runAnalyticsAudit(url, {
            ...options,
            outputDir,
          });
          break;
        case "business":
          results.audits.business = await runBusinessAudit(url, {
            ...options,
            outputDir,
          });
          break;
        // case "reputation":
        //   results.audits.reputation = await runReputationAudit(url, {
        //     ...options,
        //     outputDir,
        //   });
        //   break;
        default:
          console.warn(`Unknown audit type: ${auditType}`);
      }
    } catch (error) {
      console.error(`Error running ${auditType} audit:`, error);
      results.audits[auditType] = { error: error.message };
    }
  }

  // Save the complete audit results
  await fs.writeFile(
    path.join(outputDir, "audit-results.json"),
    JSON.stringify(results, null, 2),
  );

  return results;
}

// Performance Audit
export async function runPerformanceAudit(url, options = {}) {
  console.log(`Running performance audit on ${url}...`);
  const outputDir =
    options.outputDir || path.join(process.cwd(), "audit-results");

  // Run Lighthouse performance audit
  const lighthouseReport = await lighthouse(url, {
    preset: options.preset || "mobile",
    onlyCategories: ["performance"],
    output: ["json"],
    logLevel: options.verbose ? "info" : "error",
  });

  // Extract core metrics from Lighthouse
  const performanceScore = lighthouseReport.categories.performance.score * 100;
  const coreWebVitals = {
    LCP: findAuditResult(lighthouseReport, "largest-contentful-paint"),
    FID: findAuditResult(lighthouseReport, "max-potential-fid"),
    CLS: findAuditResult(lighthouseReport, "cumulative-layout-shift"),
    TTFB: findAuditResult(lighthouseReport, "server-response-time"),
    TBT: findAuditResult(lighthouseReport, "total-blocking-time"),
  };

  // Get JavaScript sizes and counts
  const jsMetrics = {
    totalBytes: findAuditResult(
      lighthouseReport,
      "network-requests",
      "details.items",
    )
      .filter((item) => item.resourceType === "Script")
      .reduce((total, item) => total + (item.transferSize || 0), 0),
    scriptCount: findAuditResult(
      lighthouseReport,
      "network-requests",
      "details.items",
    ).filter((item) => item.resourceType === "Script").length,
    unusedJsBytes: findAuditResult(
      lighthouseReport,
      "unused-javascript",
      "details.overallSavingsBytes",
    ),
  };

  // Check for lazy loading of images
  const imageMetrics = {
    totalImages: findAuditResult(
      lighthouseReport,
      "network-requests",
      "details.items",
    ).filter((item) => item.resourceType === "Image").length,
    offscreenImages:
      findAuditResult(lighthouseReport, "offscreen-images", "details.items")
        ?.length || 0,
    lazyLoadedImages: 0, // Will be filled in further analysis
  };

  // Get caching info
  const cachingInfo = findAuditResult(lighthouseReport, "uses-long-cache-ttl");

  // Create results object
  const results = {
    score: performanceScore.toFixed(0),
    coreWebVitals,
    jsMetrics,
    imageMetrics,
    cachingInfo: {
      wastedBytes: cachingInfo.details?.overallSavingsBytes || 0,
      potentialSavingsMs: cachingInfo.details?.overallSavingsMs || 0,
    },
    mobileResponsiveness: {
      usesViewport: findAuditResult(lighthouseReport, "viewport"),
      properViewportSize: findAuditResult(lighthouseReport, "content-width"),
    },
    recommendations: extractRecommendations(lighthouseReport, "performance"),
  };

  // Save detailed lighthouse report
  await fs.writeFile(
    path.join(outputDir, "lighthouse-performance.json"),
    JSON.stringify(lighthouseReport, null, 2),
  );

  // Get additional lazy loading details via browser analysis
  try {
    const browserless = await browser.createContext();
    const lazyLoadingData = await browserless.evaluate(
      url,
      () => {
        const images = document.querySelectorAll("img");
        let lazyLoadedCount = 0;

        images.forEach((img) => {
          if (
            img.loading === "lazy" ||
            img.getAttribute("data-src") ||
            img.getAttribute("data-lazy-src")
          ) {
            lazyLoadedCount++;
          }
        });

        return {
          totalImages: images.length,
          lazyLoadedImages: lazyLoadedCount,
        };
      },
      getGotoOptions(options),
    );

    results.imageMetrics.lazyLoadedImages = lazyLoadingData.lazyLoadedImages;
    await browserless.destroyContext();
  } catch (error) {
    console.error("Error evaluating lazy loading:", error);
  }

  return results;
}

// SEO Audit
export async function runSEOAudit(url, options = {}) {
  console.log(`Running SEO audit on ${url}...`);
  const outputDir =
    options.outputDir || path.join(process.cwd(), "audit-results");

  // Run Lighthouse SEO audit
  const lighthouseReport = await lighthouse(url, {
    preset: "mobile",
    onlyCategories: ["seo"],
    output: ["json"],
    logLevel: options.verbose ? "info" : "error",
  });

  // Extract the SEO score
  const seoScore = lighthouseReport.categories.seo.score * 100;

  // Get basic SEO metrics
  const browserless = await browser.createContext();
  try {
    const seoData = await browserless.evaluate(
      url,
      () => {
        // Extract metadata
        const title = document.querySelector("title")?.innerText;
        const metaDescription = document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content");
        const canonical = document
          .querySelector('link[rel="canonical"]')
          ?.getAttribute("href");
        const robotsMeta = document
          .querySelector('meta[name="robots"]')
          ?.getAttribute("content");

        // Extract heading structure
        const headings = {};
        ["h1", "h2", "h3", "h4", "h5", "h6"].forEach((tag) => {
          const elements = document.querySelectorAll(tag);
          headings[tag] = Array.from(elements).map((el) => el.innerText.trim());
        });

        // Extract images without alt text
        const images = document.querySelectorAll("img");
        const imagesWithoutAlt = Array.from(images)
          .filter((img) => !img.hasAttribute("alt"))
          .map((img) => img.src);

        // Check for structured data
        const structuredData = Array.from(
          document.querySelectorAll('script[type="application/ld+json"]'),
        ).map((script) => {
          try {
            return JSON.parse(script.innerText);
          } catch (e) {
            return { error: "Invalid JSON" };
          }
        });

        // Check for broken links
        const links = Array.from(document.querySelectorAll("a[href]"));
        const internalLinks = links.filter((a) => {
          const href = a.getAttribute("href");
          return (
            href &&
            !href.startsWith("http") &&
            !href.startsWith("//") &&
            !href.startsWith("javascript:") &&
            !href.startsWith("#")
          );
        }).length;

        const externalLinks = links.filter((a) => {
          const href = a.getAttribute("href");
          return href && (href.startsWith("http") || href.startsWith("//"));
        }).length;

        // Analyze keywords
        const bodyText = document.body.innerText;
        const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

        return {
          metadata: {
            title,
            metaDescription,
            canonical,
            robotsMeta,
          },
          headings,
          imagesCount: images.length,
          imagesWithoutAlt: imagesWithoutAlt.length,
          structuredData,
          links: {
            total: links.length,
            internal: internalLinks,
            external: externalLinks,
          },
          contentStats: {
            wordCount,
          },
        };
      },
      getGotoOptions(options),
    );

    // Check for sitemap.xml and robots.txt
    const sitemapUrl = new URL("/sitemap.xml", url).toString();
    const robotsUrl = new URL("/robots.txt", url).toString();

    let sitemapExists = false;
    let robotsExists = false;

    try {
      const sitemapResponse = await browserless.context.fetch(sitemapUrl);
      sitemapExists = sitemapResponse.status === 200;
    } catch (error) {
      console.error("Error checking sitemap:", error);
    }

    try {
      const robotsResponse = await browserless.context.fetch(robotsUrl);
      robotsExists = robotsResponse.status === 200;
      if (robotsExists) {
        const robotsText = await robotsResponse.text();
        seoData.robotsTxt = robotsText;
      }
    } catch (error) {
      console.error("Error checking robots.txt:", error);
    }

    // Prepare the results
    const results = {
      score: seoScore.toFixed(0),
      metadata: seoData.metadata,
      headingStructure: {
        h1Count: seoData.headings.h1?.length || 0,
        h2Count: seoData.headings.h2?.length || 0,
        h3Count: seoData.headings.h3?.length || 0,
        h1Missing: seoData.headings.h1?.length === 0,
        multipleH1: seoData.headings.h1?.length > 1,
      },
      images: {
        total: seoData.imagesCount,
        missingAlt: seoData.imagesWithoutAlt,
      },
      links: seoData.links,
      structuredData: {
        present: seoData.structuredData?.length > 0,
        types: seoData.structuredData?.map(
          (data) => data["@type"] || "unknown",
        ),
      },
      sitemapXml: sitemapExists,
      robotsTxt: {
        exists: robotsExists,
        content: seoData.robotsTxt,
      },
      contentStats: seoData.contentStats,
      recommendations: extractRecommendations(lighthouseReport, "seo"),
    };

    // Take a screenshot of the page
    const screenshotPath = path.join(outputDir, "seo-screenshot.jpg");
    await captureScreenshot(url, screenshotPath, options);

    // Save SEO report
    await fs.writeFile(
      path.join(outputDir, "seo-audit.json"),
      JSON.stringify(results, null, 2),
    );

    return results;
  } finally {
    await browserless.destroyContext();
  }
}

// Accessibility Audit
export async function runAccessibilityAudit(url, options = {}) {
  console.log(`Running accessibility audit on ${url}...`);
  const outputDir =
    options.outputDir || path.join(process.cwd(), "audit-results");

  // Run Lighthouse accessibility audit
  const lighthouseReport = await lighthouse(url, {
    preset: "mobile",
    onlyCategories: ["accessibility"],
    output: ["json"],
    logLevel: options.verbose ? "info" : "error",
  });

  // Extract accessibility score
  const accessibilityScore =
    lighthouseReport.categories.accessibility.score * 100;

  // Get more detailed accessibility data
  const browserless = await browser.createContext();
  try {
    const a11yData = await browserless.evaluate(
      url,
      () => {
        // Function to check color contrast (simplified approximation)
        function getContrastRatio(color1, color2) {
          // Convert hex to RGB
          function hexToRgb(hex) {
            const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
            hex = hex.replace(
              shorthandRegex,
              (m, r, g, b) => r + r + g + g + b + b,
            );
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(
              hex,
            );
            return result
              ? {
                  r: parseInt(result[1], 16),
                  g: parseInt(result[2], 16),
                  b: parseInt(result[3], 16),
                }
              : null;
          }

          // Calculate relative luminance
          function luminance(r, g, b) {
            const a = [r, g, b].map((v) => {
              v /= 255;
              return v <= 0.03928
                ? v / 12.92
                : Math.pow((v + 0.055) / 1.055, 2.4);
            });
            return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
          }

          // Calculate contrast ratio
          const rgb1 = hexToRgb(color1);
          const rgb2 = hexToRgb(color2);
          if (!rgb1 || !rgb2) return 1;

          const l1 = luminance(rgb1.r, rgb1.g, rgb1.b);
          const l2 = luminance(rgb2.r, rgb2.g, rgb2.b);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          return Math.round(ratio * 10) / 10;
        }

        // Check for keyboard navigability
        const focusableElements = document.querySelectorAll(
          'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );

        // Check for images with alt attributes
        const images = document.querySelectorAll("img");
        const imagesWithAlt = Array.from(images).filter((img) =>
          img.hasAttribute("alt"),
        );

        // Check for form elements with labels
        const formInputs = document.querySelectorAll("input, select, textarea");
        const inputsWithLabels = Array.from(formInputs).filter((input) => {
          const id = input.getAttribute("id");
          return id && document.querySelector(`label[for="${id}"]`);
        });

        // Check for ARIA usage
        const elementsWithAria = document.querySelectorAll(
          "[aria-label], [aria-labelledby], [aria-describedby], [role]",
        );

        // Check for skip links
        const skipLinks = document.querySelectorAll(
          'a[href^="#"]:not([href="#"])',
        );
        const hasSkipToMainContent = Array.from(skipLinks).some(
          (link) =>
            link.innerText.toLowerCase().includes("skip") ||
            link.innerText.toLowerCase().includes("main content"),
        );

        return {
          keyboardNavigation: {
            focusableElementsCount: focusableElements.length,
          },
          images: {
            total: images.length,
            withAlt: imagesWithAlt.length,
          },
          forms: {
            inputs: formInputs.length,
            inputsWithLabels: inputsWithLabels.length,
          },
          aria: {
            elementsWithAria: elementsWithAria.length,
          },
          skipLinks: {
            present: hasSkipToMainContent,
          },
        };
      },
      getGotoOptions(options),
    );

    // Extract recommendations from Lighthouse
    const contrastIssues = findAuditResult(lighthouseReport, "color-contrast");
    const ariaIssues = {
      ariaValidAttr: findAuditResult(lighthouseReport, "aria-valid-attr"),
      ariaRoles: findAuditResult(lighthouseReport, "aria-roles"),
    };

    // Prepare the results
    const results = {
      score: accessibilityScore.toFixed(0),
      colorContrast: {
        passingRatio: contrastIssues.score,
        issuesFound: contrastIssues.details?.items?.length || 0,
      },
      keyboardNavigation: a11yData.keyboardNavigation,
      imageAlts: {
        total: a11yData.images.total,
        withAlt: a11yData.images.withAlt,
        withoutAlt: a11yData.images.total - a11yData.images.withAlt,
        ratio: a11yData.images.total
          ? ((a11yData.images.withAlt / a11yData.images.total) * 100).toFixed(1)
          : 100,
      },
      formAccessibility: {
        inputs: a11yData.forms.inputs,
        inputsWithLabels: a11yData.forms.inputsWithLabels,
        inputsWithoutLabels:
          a11yData.forms.inputs - a11yData.forms.inputsWithLabels,
        ratio: a11yData.forms.inputs
          ? (
              (a11yData.forms.inputsWithLabels / a11yData.forms.inputs) *
              100
            ).toFixed(1)
          : 100,
      },
      ariaUsage: {
        elementsWithAria: a11yData.aria.elementsWithAria,
        validAriaAttributes: ariaIssues.ariaValidAttr.score === 1,
        validAriaRoles: ariaIssues.ariaRoles.score === 1,
      },
      skipLinks: a11yData.skipLinks,
      recommendations: extractRecommendations(
        lighthouseReport,
        "accessibility",
      ),
    };

    // Take a screenshot of the page
    const screenshotPath = path.join(outputDir, "accessibility-screenshot.jpg");
    await captureScreenshot(url, screenshotPath, options);

    // Save detailed accessibility report
    await fs.writeFile(
      path.join(outputDir, "accessibility-audit.json"),
      JSON.stringify(results, null, 2),
    );

    return results;
  } finally {
    await browserless.destroyContext();
  }
}

// UX & Design Audit
export async function runUXAudit(url, options = {}) {
  console.log(`Running UX & Design audit on ${url}...`);
  const outputDir =
    options.outputDir || path.join(process.cwd(), "audit-results");

  const browserless = await browser.createContext();
  try {
    // Get detailed UX metrics
    const uxData = await browserless.evaluate(
      url,
      () => {
        // Analyze visual hierarchy
        const headings = {
          h1: Array.from(document.querySelectorAll("h1")).map((h) => ({
            text: h.innerText.trim(),
            fontSize: window.getComputedStyle(h).fontSize,
            fontWeight: window.getComputedStyle(h).fontWeight,
          })),
          h2: Array.from(document.querySelectorAll("h2")).map((h) => ({
            text: h.innerText.trim(),
            fontSize: window.getComputedStyle(h).fontSize,
            fontWeight: window.getComputedStyle(h).fontWeight,
          })),
          h3: Array.from(document.querySelectorAll("h3")).map((h) => ({
            text: h.innerText.trim(),
            fontSize: window.getComputedStyle(h).fontSize,
            fontWeight: window.getComputedStyle(h).fontWeight,
          })),
        };

        // Analyze CTAs
        const buttons = Array.from(
          document.querySelectorAll(
            'button, a.btn, .button, [role="button"], a.cta, .cta',
          ),
        );
        const ctas = buttons
          .map((btn) => ({
            text: btn.innerText.trim(),
            visible: btn.offsetParent !== null,
            aboveTheFold: btn.getBoundingClientRect().top < window.innerHeight,
            color: window.getComputedStyle(btn).backgroundColor,
            fontSize: window.getComputedStyle(btn).fontSize,
          }))
          .filter((cta) => cta.visible);

        // Analyze navigation
        const navItems = Array.from(
          document.querySelectorAll("nav a, header a, .menu a, .navigation a"),
        );
        const footerLinks = Array.from(document.querySelectorAll("footer a"));

        // Analyze mobile-friendliness
        const viewport = document
          .querySelector('meta[name="viewport"]')
          ?.getAttribute("content");
        const hasMediaQueries = Array.from(document.styleSheets).some(
          (sheet) => {
            try {
              return Array.from(sheet.cssRules).some(
                (rule) => rule.type === CSSRule.MEDIA_RULE,
              );
            } catch (e) {
              // CORS restriction might prevent reading cssRules
              return false;
            }
          },
        );

        // Check for trust signals
        const trustSignals = {
          hasSocialProof:
            document.body.innerText.toLowerCase().includes("testimonial") ||
            document.body.innerHTML.toLowerCase().includes("review") ||
            document.body.innerHTML.toLowerCase().includes("stars") ||
            document.body.innerHTML.toLowerCase().includes("★"),
          hasContactInfo:
            document.body.innerText.toLowerCase().includes("contact") ||
            document.body.innerText.match(
              /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}/g,
            ) !== null ||
            document.body.innerText.match(
              /(\+\d{1,3}[-\s]?)?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}/g,
            ) !== null,
          hasSSL: window.location.protocol === "https:",
          hasCertifications:
            document.body.innerHTML.toLowerCase().includes("certified") ||
            document.body.innerHTML.toLowerCase().includes("certificate") ||
            document.body.innerHTML.toLowerCase().includes("accredited"),
        };

        return {
          visualHierarchy: {
            headings,
          },
          ctas: {
            total: ctas.length,
            aboveTheFold: ctas.filter((cta) => cta.aboveTheFold).length,
            ctaTexts: ctas.map((cta) => cta.text).slice(0, 5), // Just list first 5
          },
          navigation: {
            navItems: navItems.length,
            footerLinks: footerLinks.length,
          },
          mobileFirst: {
            hasViewport: !!viewport,
            hasMediaQueries,
          },
          trustSignals,
        };
      },
      getGotoOptions(options),
    );

    // Take multiple screenshots for different viewport sizes
    const desktopScreenshotPath = path.join(
      outputDir,
      "ux-desktop-screenshot.jpg",
    );
    await browserless.screenshot(url, {
      ...getGotoOptions({ ...options, device: "macbook pro 13" }),
      type: "jpeg",
      quality: 80,
      path: desktopScreenshotPath,
    });

    const mobileScreenshotPath = path.join(
      outputDir,
      "ux-mobile-screenshot.jpg",
    );
    await browserless.screenshot(url, {
      ...getGotoOptions({ ...options, device: "iPhone X" }),
      type: "jpeg",
      quality: 80,
      path: mobileScreenshotPath,
    });

    // Prepare the results
    const results = {
      visualHierarchy: {
        headingStructure: {
          h1Count: uxData.visualHierarchy.headings.h1.length,
          h2Count: uxData.visualHierarchy.headings.h2.length,
          h3Count: uxData.visualHierarchy.headings.h3.length,
        },
        hasProperHierarchy: uxData.visualHierarchy.headings.h1.length > 0,
      },
      callsToAction: {
        totalVisible: uxData.ctas.total,
        aboveTheFold: uxData.ctas.aboveTheFold,
        examples: uxData.ctas.ctaTexts,
      },
      navigation: {
        navItems: uxData.navigation.navItems,
        footerLinks: uxData.navigation.footerLinks,
      },
      responsiveDesign: {
        hasViewportMeta: uxData.mobileFirst.hasViewport,
        hasMediaQueries: uxData.mobileFirst.hasMediaQueries,
        isResponsive:
          uxData.mobileFirst.hasViewport && uxData.mobileFirst.hasMediaQueries,
      },
      trustFactors: {
        hasSocialProof: uxData.trustSignals.hasSocialProof,
        hasContactInfo: uxData.trustSignals.hasContactInfo,
        usesHttps: uxData.trustSignals.hasSSL,
        hasCertifications: uxData.trustSignals.hasCertifications,
      },
      screenshots: {
        desktop: desktopScreenshotPath,
        mobile: mobileScreenshotPath,
      },
    };

    // Save UX report
    await fs.writeFile(
      path.join(outputDir, "ux-audit.json"),
      JSON.stringify(results, null, 2),
    );

    return results;
  } finally {
    await browserless.destroyContext();
  }
}

// Content Audit
export async function runContentAudit(url, options = {}) {
  console.log(`Running content audit on ${url}...`);
  const outputDir =
    options.outputDir || path.join(process.cwd(), "audit-results");
  const skipLM = options.skipLM || !options.lmConfig;

  const browserless = await browser.createContext();
  try {
    // Get content metrics
    const contentData = await browserless.evaluate(
      url,
      () => {
        // Extract main content
        const mainContent =
          document.querySelector("main") ||
          document.querySelector("article") ||
          document.querySelector("#content") ||
          document.querySelector(".content") ||
          document.body;

        const bodyText = mainContent.innerText;
        const paragraphs = Array.from(mainContent.querySelectorAll("p"))
          .map((p) => p.innerText.trim())
          .filter((t) => t.length > 0);

        // Count words
        const words = bodyText.split(/\s+/).filter(Boolean);
        const wordCount = words.length;

        // Calculate reading time (average reading speed: 200-250 words per minute)
        const readingTimeMinutes = Math.ceil(wordCount / 225);

        // Check for blog posts and last updated dates
        const lastUpdated = document.querySelector(
          'time[datetime], [class*="date"], [class*="updated"], [class*="published"], meta[property="article:published_time"]',
        );
        const lastUpdatedText = lastUpdated
          ? lastUpdated.textContent ||
            lastUpdated.getAttribute("datetime") ||
            lastUpdated.getAttribute("content")
          : null;

        // Check for multimedia content
        const images = mainContent.querySelectorAll("img");
        const videos = mainContent.querySelectorAll(
          'video, iframe[src*="youtube"], iframe[src*="vimeo"]',
        );

        // Check for internal linking
        const internalLinks = Array.from(
          mainContent.querySelectorAll("a[href]"),
        ).filter((a) => {
          const href = a.getAttribute("href");
          return (
            href &&
            !href.startsWith("http") &&
            !href.startsWith("//") &&
            !href.startsWith("javascript:")
          );
        });

        // Get content headings for structure analysis
        const headings = Array.from(
          mainContent.querySelectorAll("h1, h2, h3, h4"),
        ).map((h) => ({
          level: parseInt(h.tagName.substring(1)),
          text: h.innerText.trim(),
        }));

        // Check for lists which show content organization
        const lists = mainContent.querySelectorAll("ul, ol");

        return {
          wordCount,
          paragraphs: paragraphs.length,
          averageParagraphLength: paragraphs.length
            ? Math.round(words.length / paragraphs.length)
            : 0,
          readingTime: readingTimeMinutes,
          lastUpdated: lastUpdatedText,
          multimedia: {
            images: images.length,
            videos: videos.length,
          },
          internalLinks: internalLinks.length,
          headings,
          lists: lists.length,
          firstParagraph: paragraphs[0] || "",
          sampleText: paragraphs.slice(0, 3).join(" ").substring(0, 500), // Sample text for analysis
        };
      },
      getGotoOptions(options),
    );

    let contentAnalysis = {
      readability: "Not analyzed",
      keywordDensity: {},
      sentiment: "Not analyzed",
      tone: "Not analyzed",
    };

    // Use Language Model for content analysis if enabled
    if (!skipLM && options.lmConfig) {
      try {
        const lmAnalysis = await analyzeLMContent(
          contentData.sampleText,
          options.lmConfig,
        );
        contentAnalysis = lmAnalysis;
      } catch (error) {
        console.error("Error with LM analysis:", error);
      }
    } else {
      // Basic analysis without LM
      // Basic readability calculation (Flesch-Kincaid simplified)
      const text = contentData.sampleText;
      const sentences = text.split(/[.!?]+/).filter(Boolean).length;
      const words = text.split(/\s+/).filter(Boolean).length;
      const syllables = countSyllables(text);

      // Simple Flesch-Kincaid Grade Level formula
      const readabilityScore =
        0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
      let readabilityLevel = "Advanced";
      if (readabilityScore < 6) readabilityLevel = "Elementary";
      else if (readabilityScore < 10) readabilityLevel = "Intermediate";
      else if (readabilityScore < 14) readabilityLevel = "High School";
      else if (readabilityScore < 18) readabilityLevel = "College";

      contentAnalysis.readability = readabilityLevel;

      // Basic keyword density
      const wordFrequency = {};
      const words2 = text
        .toLowerCase()
        .split(/\W+/)
        .filter((word) => word.length > 3);
      words2.forEach((word) => {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      });

      // Sort by frequency and get top 5
      const sortedWords = Object.entries(wordFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      sortedWords.forEach(([word, count]) => {
        contentAnalysis.keywordDensity[word] = count;
      });
    }

    // Prepare the results
    const results = {
      contentMetrics: {
        wordCount: contentData.wordCount,
        paragraphs: contentData.paragraphs,
        averageParagraphLength: contentData.averageParagraphLength,
        readingTimeMinutes: contentData.readingTime,
      },
      contentQuality: {
        readability: contentAnalysis.readability,
        topKeywords: contentAnalysis.keywordDensity,
        sentiment: contentAnalysis.sentiment || "Not analyzed",
        tone: contentAnalysis.tone || "Not analyzed",
      },
      contentStructure: {
        headingCount: contentData.headings.length,
        listsCount: contentData.lists,
        hasProperHierarchy:
          contentData.headings.some((h) => h.level === 1) &&
          contentData.headings.some((h) => h.level === 2),
      },
      contentFreshness: {
        lastUpdated: contentData.lastUpdated || "Not found",
      },
      multimedia: contentData.multimedia,
      internalLinking: {
        count: contentData.internalLinks,
      },
    };

    // Take a screenshot
    const screenshotPath = path.join(outputDir, "content-screenshot.jpg");
    await captureScreenshot(url, screenshotPath, options);

    // Save content audit report
    await fs.writeFile(
      path.join(outputDir, "content-audit.json"),
      JSON.stringify(results, null, 2),
    );

    return results;
  } finally {
    await browserless.destroyContext();
  }
}

// Security Audit
export async function runSecurityAudit(url, options = {}) {
  console.log(`Running security audit on ${url}...`);
  const outputDir =
    options.outputDir || path.join(process.cwd(), "audit-results");

  const securityResults = {
    ssl: { valid: false, details: {} },
    securityHeaders: {},
    contentSecurity: { policy: null, headers: {} },
    cookieSecurity: {},
    vulnerabilities: [],
  };

  // Check SSL certificate
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const protocol = urlObj.protocol;

    securityResults.ssl.valid = protocol === "https:";
    securityResults.ssl.details = {
      protocol,
      hostname,
      secured: protocol === "https:",
    };
  } catch (error) {
    console.error("Error checking SSL:", error);
    securityResults.ssl.error = error.message;
  }

  // Check security headers
  const browserless = await browser.createContext();
  try {
    // Fetch headers
    const response = await browserless.context.fetch(url);
    const headers = response.headers;

    // Process security-related headers
    const securityHeaders = {
      "Content-Security-Policy": headers.get("Content-Security-Policy"),
      "X-Content-Type-Options": headers.get("X-Content-Type-Options"),
      "X-Frame-Options": headers.get("X-Frame-Options"),
      "X-XSS-Protection": headers.get("X-XSS-Protection"),
      "Strict-Transport-Security": headers.get("Strict-Transport-Security"),
      "Referrer-Policy": headers.get("Referrer-Policy"),
      "Permissions-Policy":
        headers.get("Permissions-Policy") || headers.get("Feature-Policy"),
    };

    // Evaluate each security header
    securityResults.securityHeaders = {
      "Content-Security-Policy": {
        present: !!securityHeaders["Content-Security-Policy"],
        value: securityHeaders["Content-Security-Policy"],
      },
      "X-Content-Type-Options": {
        present: !!securityHeaders["X-Content-Type-Options"],
        valid: securityHeaders["X-Content-Type-Options"] === "nosniff",
      },
      "X-Frame-Options": {
        present: !!securityHeaders["X-Frame-Options"],
        value: securityHeaders["X-Frame-Options"],
      },
      "X-XSS-Protection": {
        present: !!securityHeaders["X-XSS-Protection"],
        valid: securityHeaders["X-XSS-Protection"] === "1; mode=block",
      },
      "Strict-Transport-Security": {
        present: !!securityHeaders["Strict-Transport-Security"],
        value: securityHeaders["Strict-Transport-Security"],
      },
      "Referrer-Policy": {
        present: !!securityHeaders["Referrer-Policy"],
        value: securityHeaders["Referrer-Policy"],
      },
      "Permissions-Policy": {
        present: !!securityHeaders["Permissions-Policy"],
        value: securityHeaders["Permissions-Policy"],
      },
    };

    // Check for content security issues
    if (securityHeaders["Content-Security-Policy"]) {
      securityResults.contentSecurity.policy =
        securityHeaders["Content-Security-Policy"];

      // Parse CSP directives
      const cspParts = securityHeaders["Content-Security-Policy"].split(";");
      cspParts.forEach((part) => {
        const [directive, ...values] = part.trim().split(/\s+/);
        if (directive) {
          securityResults.contentSecurity.headers[directive] = values.join(" ");
        }
      });
    }

    // Check for cookie security
    const cookieHeader = headers.get("Set-Cookie");
    if (cookieHeader) {
      const cookies = cookieHeader.split(",").map((c) => c.trim());
      securityResults.cookieSecurity = {
        count: cookies.length,
        secureFlagPresent: cookies.some((c) => c.includes("Secure")),
        httpOnlyFlagPresent: cookies.some((c) => c.includes("HttpOnly")),
        sameSiteFlagPresent: cookies.some((c) => c.includes("SameSite")),
      };
    }

    // Check for exposed CMS or plugin versions
    const html = await response.text();
    const cmsVersions = [];

    // WordPress
    const wpVersionMatch = html.match(
      /wp-content\/themes\/(.*?)\/|wp-content\/plugins\/(.*?)\//g,
    );
    if (wpVersionMatch) {
      cmsVersions.push({
        name: "WordPress",
        detectionMethod: "Path analysis",
        detectedComponents: [...new Set(wpVersionMatch)].slice(0, 5),
      });
    }

    // Drupal
    if (html.includes("Drupal.settings") || html.includes("drupal.org")) {
      cmsVersions.push({
        name: "Drupal",
        detectionMethod: "Script presence",
      });
    }

    // Joomla
    if (html.includes("joomla") || html.includes("/media/system/js/")) {
      cmsVersions.push({
        name: "Joomla",
        detectionMethod: "Script presence",
      });
    }

    if (cmsVersions.length > 0) {
      securityResults.vulnerabilities.push({
        type: "CMS Version Disclosure",
        details: cmsVersions,
      });
    }

    // Check for Mixed Content
    const mixedContentCheck = await browserless.evaluate(
      url,
      () => {
        // Check for mixed content warnings
        const mixedContent = {
          detected: false,
          items: [],
        };

        if (window.location.protocol === "https:") {
          const insecureElements = [];

          // Check images
          document.querySelectorAll('img[src^="http:"]').forEach((img) => {
            insecureElements.push({
              type: "image",
              url: img.src,
            });
          });

          // Check scripts
          document
            .querySelectorAll('script[src^="http:"]')
            .forEach((script) => {
              insecureElements.push({
                type: "script",
                url: script.src,
              });
            });

          // Check stylesheets
          document
            .querySelectorAll('link[rel="stylesheet"][href^="http:"]')
            .forEach((link) => {
              insecureElements.push({
                type: "stylesheet",
                url: link.href,
              });
            });

          mixedContent.detected = insecureElements.length > 0;
          mixedContent.items = insecureElements;
        }

        return mixedContent;
      },
      getGotoOptions(options),
    );

    if (mixedContentCheck.detected) {
      securityResults.vulnerabilities.push({
        type: "Mixed Content",
        details: mixedContentCheck,
      });
    }

    // Final security score calculation (simplified)
    const scoreFactors = [
      securityResults.ssl.valid ? 20 : 0,
      securityResults.securityHeaders["Content-Security-Policy"].present
        ? 15
        : 0,
      securityResults.securityHeaders["X-Content-Type-Options"].valid ? 10 : 0,
      securityResults.securityHeaders["X-Frame-Options"].present ? 10 : 0,
      securityResults.securityHeaders["X-XSS-Protection"].valid ? 10 : 0,
      securityResults.securityHeaders["Strict-Transport-Security"].present
        ? 15
        : 0,
      securityResults.securityHeaders["Referrer-Policy"].present ? 10 : 0,
      securityResults.vulnerabilities.length === 0 ? 10 : 0,
    ];

    const securityScore = scoreFactors.reduce(
      (total, score) => total + score,
      0,
    );
    securityResults.score = securityScore;

    // Generate security recommendations
    securityResults.recommendations = [];

    if (!securityResults.ssl.valid) {
      securityResults.recommendations.push("Enable HTTPS/SSL for your website");
    }

    if (!securityResults.securityHeaders["Content-Security-Policy"].present) {
      securityResults.recommendations.push(
        "Implement a Content Security Policy",
      );
    }

    if (!securityResults.securityHeaders["X-Content-Type-Options"].valid) {
      securityResults.recommendations.push(
        "Add X-Content-Type-Options: nosniff header",
      );
    }

    if (!securityResults.securityHeaders["X-Frame-Options"].present) {
      securityResults.recommendations.push(
        "Add X-Frame-Options header to prevent clickjacking",
      );
    }

    if (!securityResults.securityHeaders["Strict-Transport-Security"].present) {
      securityResults.recommendations.push(
        "Implement HTTP Strict Transport Security (HSTS)",
      );
    }

    if (mixedContentCheck.detected) {
      securityResults.recommendations.push(
        "Fix mixed content issues (HTTP resources on HTTPS page)",
      );
    }

    // Save security audit report
    await fs.writeFile(
      path.join(outputDir, "security-audit.json"),
      JSON.stringify(securityResults, null, 2),
    );

    return securityResults;
  } finally {
    await browserless.destroyContext();
  }
}

// Analytics & Tagging Audit
export async function runAnalyticsAudit(url, options = {}) {
  console.log(`Running analytics & tagging audit on ${url}...`);
  const outputDir =
    options.outputDir || path.join(process.cwd(), "audit-results");

  const browserless = await browser.createContext();
  try {
    // Get analytics and tracking code information
    const analyticsData = await browserless.evaluate(
      url,
      () => {
        const results = {
          googleAnalytics: {
            detected: false,
            version: null,
            id: null,
          },
          googleTagManager: {
            detected: false,
            id: null,
          },
          facebookPixel: {
            detected: false,
            id: null,
          },
          otherTrackers: [],
          consentManagement: {
            detected: false,
            type: null,
          },
        };

        // Check for standard script contents
        const scripts = Array.from(document.scripts);
        const scriptContents = scripts
          .map((script) => script.textContent || "")
          .join(" ");
        const scriptSrcs = scripts.map((script) => script.src || "").join(" ");

        // Google Analytics detection
        if (scriptContents.includes("google-analytics.com/analytics.js")) {
          results.googleAnalytics.detected = true;
          results.googleAnalytics.version = "Universal Analytics";

          // Try to extract UA ID
          const uaMatch = scriptContents.match(/UA-\d+-\d+/);
          if (uaMatch) {
            results.googleAnalytics.id = uaMatch[0];
          }
        }

        if (scriptContents.includes("google-analytics.com/ga.js")) {
          results.googleAnalytics.detected = true;
          results.googleAnalytics.version = "Classic Analytics";
        }

        if (
          scriptContents.includes("googletagmanager.com/gtag/js") ||
          scriptSrcs.includes("googletagmanager.com/gtag/js")
        ) {
          results.googleAnalytics.detected = true;
          results.googleAnalytics.version = "Google Analytics 4";

          // Try to extract GA4 ID
          const ga4Match =
            scriptContents.match(/G-[A-Z0-9]+/) ||
            scriptSrcs.match(/G-[A-Z0-9]+/);
          if (ga4Match) {
            results.googleAnalytics.id = ga4Match[0];
          }
        }

        // Google Tag Manager detection
        if (
          scriptContents.includes("googletagmanager.com/gtm.js") ||
          scriptSrcs.includes("googletagmanager.com/gtm.js")
        ) {
          results.googleTagManager.detected = true;

          // Try to extract GTM ID
          const gtmMatch =
            scriptContents.match(/GTM-[A-Z0-9]+/) ||
            scriptSrcs.match(/GTM-[A-Z0-9]+/);
          if (gtmMatch) {
            results.googleTagManager.id = gtmMatch[0];
          }
        }

        // Facebook Pixel detection
        if (
          scriptContents.includes("connect.facebook.net") ||
          scriptContents.includes("fbq(")
        ) {
          results.facebookPixel.detected = true;

          // Try to extract Facebook Pixel ID
          const fbMatch =
            scriptContents.match(/fbq\('init', *'(\d+)'\)/) ||
            scriptContents.match(/pixelId: *['"](\d+)['"]/);
          if (fbMatch && fbMatch[1]) {
            results.facebookPixel.id = fbMatch[1];
          }
        }

        // Check for other common tracking tools
        const trackers = [
          { name: "HotJar", pattern: "hotjar.com" },
          { name: "Crazy Egg", pattern: "crazyegg.com" },
          { name: "Mixpanel", pattern: "mixpanel.com" },
          { name: "Segment", pattern: "segment.com" },
          { name: "LinkedIn Insight", pattern: "linkedin.com/insight" },
          { name: "Twitter Pixel", pattern: "static.ads-twitter.com" },
          { name: "Intercom", pattern: "intercom.io" },
          { name: "Drift", pattern: "drift.com" },
          { name: "Hubspot", pattern: "hubspot.com" },
          { name: "Amplitude", pattern: "amplitude.com" },
          { name: "Heap", pattern: "heap.io" },
          { name: "FullStory", pattern: "fullstory.com" },
        ];

        trackers.forEach((tracker) => {
          if (
            scriptContents.includes(tracker.pattern) ||
            scriptSrcs.includes(tracker.pattern)
          ) {
            results.otherTrackers.push(tracker.name);
          }
        });

        // Check for consent management
        const consentPatterns = [
          { type: "CookieBot", pattern: "cookiebot.com" },
          { type: "OneTrust", pattern: "onetrust.com" },
          { type: "TrustArc", pattern: "trustarc.com" },
          { type: "GDPR Cookie Consent", pattern: "gdprcookieconsent" },
          { type: "Cookie Notice", pattern: "cookie-notice" },
          { type: "Cookie Law Info", pattern: "cookie-law-info" },
          { type: "Cookie Consent", pattern: "cookieconsent" },
        ];

        consentPatterns.forEach((consent) => {
          if (
            scriptContents.includes(consent.pattern) ||
            scriptSrcs.includes(consent.pattern) ||
            document.body.innerHTML.includes(consent.pattern)
          ) {
            results.consentManagement.detected = true;
            results.consentManagement.type = consent.type;
          }
        });

        // Check for cookie consent UI
        const cookieConsentElements = document.querySelectorAll(
          '[class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"], [class*="gdpr"], [id*="gdpr"]',
        );
        if (cookieConsentElements.length > 0) {
          if (!results.consentManagement.detected) {
            results.consentManagement.detected = true;
            results.consentManagement.type = "Custom/Unknown";
          }
        }

        return results;
      },
      getGotoOptions(options),
    );

    // Check for conversion tracking setup
    const conversionTracking = await browserless.evaluate(
      url,
      () => {
        const results = {
          goalTracking: false,
          ecommerceTracking: false,
          eventTracking: false,
        };

        const scriptContents = Array.from(document.scripts)
          .map((script) => script.textContent || "")
          .join(" ");

        // Check for goal/conversion tracking
        if (
          scriptContents.includes("gtag('event'") ||
          scriptContents.includes("ga('send'") ||
          scriptContents.includes("_gaq.push") ||
          scriptContents.includes("dataLayer.push") ||
          scriptContents.includes("fbq('track'")
        ) {
          results.eventTracking = true;
        }

        // Check for e-commerce tracking
        if (
          scriptContents.includes("ecommerce") ||
          scriptContents.includes("purchase") ||
          scriptContents.includes("transaction") ||
          scriptContents.includes("ec:addProduct")
        ) {
          results.ecommerceTracking = true;
        }

        // Check for goal/conversion tracking
        if (results.eventTracking || results.ecommerceTracking) {
          results.goalTracking = true;
        }

        return results;
      },
      getGotoOptions(options),
    );

    // Combine the results
    const results = {
      googleAnalytics: analyticsData.googleAnalytics,
      googleTagManager: analyticsData.googleTagManager,
      facebookPixel: analyticsData.facebookPixel,
      otherTrackers: analyticsData.otherTrackers,
      conversionTracking,
      complianceTools: {
        consentManagement: analyticsData.consentManagement,
      },
      recommendations: [],
    };

    // Generate recommendations
    if (
      !results.googleAnalytics.detected &&
      !results.googleTagManager.detected
    ) {
      results.recommendations.push(
        "Add Google Analytics (preferably GA4) to track user behavior",
      );
    } else if (results.googleAnalytics.version === "Universal Analytics") {
      results.recommendations.push(
        "Upgrade from Universal Analytics to Google Analytics 4",
      );
    }

    if (!results.conversionTracking.goalTracking) {
      results.recommendations.push(
        "Set up goal tracking and conversion events",
      );
    }

    if (!results.complianceTools.consentManagement.detected) {
      results.recommendations.push(
        "Implement a cookie consent solution for GDPR/CCPA compliance",
      );
    }

    // Save the analytics audit report
    await fs.writeFile(
      path.join(outputDir, "analytics-audit.json"),
      JSON.stringify(results, null, 2),
    );

    // Take a screenshot
    const screenshotPath = path.join(outputDir, "analytics-screenshot.jpg");
    await captureScreenshot(url, screenshotPath, options);

    return results;
  } finally {
    await browserless.destroyContext();
  }
}

// Business Alignment Audit
export async function runBusinessAudit(url, options = {}) {
  console.log(`Running business alignment audit on ${url}...`);
  const outputDir =
    options.outputDir || path.join(process.cwd(), "audit-results");

  const browserless = await browser.createContext();
  try {
    // Extract business-related information
    const businessData = await browserless.evaluate(
      url,
      () => {
        const results = {
          valueProposition: {
            detected: false,
            text: null,
          },
          contactMethods: {
            email: null,
            phone: null,
            contactForm: false,
            physicalAddress: null,
          },
          leadGeneration: {
            forms: 0,
            ctaCount: 0,
            newsletter: false,
          },
          socialProof: {
            testimonials: 0,
            reviews: false,
            clientLogos: 0,
            casesStudies: false,
          },
          onlineBooking: false,
          ecommerce: {
            detected: false,
            products: 0,
            cart: false,
            checkout: false,
          },
        };

        // Check for value proposition (typically in hero section)
        const heroSection = document.querySelector(
          'header, .hero, [class*="hero"], [class*="banner"], [class*="jumbotron"]',
        );
        if (heroSection) {
          const headings = heroSection.querySelectorAll("h1, h2");
          if (headings.length > 0) {
            results.valueProposition.detected = true;
            results.valueProposition.text = Array.from(headings)
              .map((h) => h.innerText.trim())
              .filter(Boolean)[0];
          }
        }

        // Check for contact methods
        const bodyText = document.body.innerText;
        const bodyHTML = document.body.innerHTML;

        // Email detection
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emailMatches = bodyText.match(emailRegex);
        if (emailMatches) {
          results.contactMethods.email = emailMatches[0];
        }

        // Phone detection
        const phoneRegex =
          /(\+\d{1,3}[-\s]?)?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}/g;
        const phoneMatches = bodyText.match(phoneRegex);
        if (phoneMatches) {
          results.contactMethods.phone = phoneMatches[0];
        }

        // Contact form detection
        const contactForm = document.querySelector(
          'form[action*="contact"], form[id*="contact"], form[class*="contact"]',
        );
        results.contactMethods.contactForm = !!contactForm;

        // Address detection (simplified)
        const addressPatterns = [
          /\d+\s+[A-Za-z0-9\s,]+,\s+[A-Za-z\s]+,\s+[A-Z]{2}\s+\d{5}/, // US format
          /\d+\s+[A-Za-z0-9\s,]+,\s+[A-Za-z\s]+,\s+[A-Z]{2}\s+[A-Z0-9]{3}/, // UK/CA format
        ];

        for (const pattern of addressPatterns) {
          const addressMatch = bodyText.match(pattern);
          if (addressMatch) {
            results.contactMethods.physicalAddress = addressMatch[0];
            break;
          }
        }

        // Lead generation forms
        const forms = document.querySelectorAll("form");
        results.leadGeneration.forms = forms.length;

        // CTA detection
        const ctaElements = document.querySelectorAll(
          'a.btn, button, a[class*="cta"], [class*="call-to-action"]',
        );
        results.leadGeneration.ctaCount = ctaElements.length;

        // Newsletter signup detection
        results.leadGeneration.newsletter =
          bodyHTML.toLowerCase().includes("newsletter") ||
          bodyHTML.toLowerCase().includes("subscribe");

        // Social proof detection
        results.socialProof.testimonials = (
          bodyHTML.match(/testimonial/gi) || []
        ).length;
        results.socialProof.reviews =
          bodyHTML.toLowerCase().includes("review") ||
          bodyHTML.toLowerCase().includes("rating") ||
          bodyHTML.includes("★");

        // Client logo detection (approximate)
        const logos = document.querySelectorAll(
          '[class*="client"] img, [class*="partner"] img, [class*="logo-"] img, [class*="logos"] img',
        );
        results.socialProof.clientLogos = logos.length;

        // Case studies detection
        results.socialProof.caseStudies =
          bodyHTML.toLowerCase().includes("case stud") ||
          bodyHTML.toLowerCase().includes("success stor");

        // Online booking detection
        results.onlineBooking =
          bodyHTML.toLowerCase().includes("book") ||
          bodyHTML.toLowerCase().includes("schedule") ||
          bodyHTML.toLowerCase().includes("appointment");

        // E-commerce detection
        results.ecommerce.detected =
          bodyHTML.toLowerCase().includes("shop") ||
          bodyHTML.toLowerCase().includes("product") ||
          bodyHTML.toLowerCase().includes("cart") ||
          bodyHTML.toLowerCase().includes("checkout");

        if (results.ecommerce.detected) {
          const productElements = document.querySelectorAll(
            '[class*="product"], [id*="product"]',
          );
          results.ecommerce.products = productElements.length;

          results.ecommerce.cart =
            bodyHTML.toLowerCase().includes("cart") ||
            bodyHTML.toLowerCase().includes("basket");

          results.ecommerce.checkout =
            bodyHTML.toLowerCase().includes("checkout") ||
            bodyHTML.toLowerCase().includes("payment");
        }

        return results;
      },
      getGotoOptions(options),
    );

    // // Check for social media links
    // const socialData = await browserless.evaluate(url, () => {
    //   const socialLinks = {
    //     platforms: []
    //   };

    //   const socialPlatforms
    return { businessData };
  } finally {
    await browserless.destroyContext();
  }
}
