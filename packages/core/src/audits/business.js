import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { runLM, lmAvailable } from "./lm-interface.js";
import { gotoOptions } from "./goto-options.js";
import { browser } from "../adapters/browser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runBusinessAudit(url, options = {}) {
  const outputDir =
    options.outputDir || path.join(process.cwd(), "audit-results");
  await fs.mkdir(outputDir, { recursive: true });
  const browserless = await browser.createContext();
  let business = {};
  try {
    const extractBusiness = await browserless.evaluate(
      async (page) =>
        page.evaluate(() => {
          const text = document.body.innerText || "";
          const visible = (el) =>
            !!el &&
            el.getBoundingClientRect().height > 0 &&
            getComputedStyle(el).visibility !== "hidden";

          // Match link text/labels rather than raw HTML: searching the whole
          // document for "book" matches "Facebook", for "product" matches
          // almost any page, and so on.
          const actionables = Array.from(
            document.querySelectorAll(
              'a, button, input[type="submit"], input[type="button"], [role="button"]',
            ),
          ).map((el) => ({
            el,
            label: (
              el.innerText ||
              el.value ||
              el.getAttribute("aria-label") ||
              ""
            )
              .trim()
              .toLowerCase(),
            href: el.getAttribute("href") || "",
          }));
          const anyLabel = (re) => actionables.some((a) => re.test(a.label));

          // The value proposition is the leading headline, not the literal word
          // "value" appearing somewhere on the page. Prefer an h1, but fall
          // back to an h2 — plenty of real sites ship no h1 at all, and that
          // absence is reported separately rather than hidden as a null.
          const readText = (el) => {
            if (!el) return null;
            // innerText is "" for visually hidden text; textContent still has it.
            const t =
              (el.innerText || "").trim() || (el.textContent || "").trim();
            return t ? t.replace(/\s+/g, " ").slice(0, 300) : null;
          };
          const HERO_SCOPE =
            'main, header, [class*="hero" i], [class*="banner" i], [class*="jumbotron" i]';
          const findHeading = (tag) => {
            for (const scope of document.querySelectorAll(HERO_SCOPE)) {
              const h = scope.querySelector(tag);
              if (h && readText(h)) return h;
            }
            return Array.from(document.querySelectorAll(tag)).find((h) =>
              readText(h),
            );
          };
          const hero = findHeading("h1") || findHeading("h2");
          const heroSub = hero
            ? hero.parentElement?.querySelector("h2, h3, p")
            : null;
          const valueProp = {
            headline: readText(hero),
            headlineLevel: hero ? hero.tagName.toLowerCase() : null,
            subhead: heroSub === hero ? null : readText(heroSub),
            aboveFold: hero
              ? hero.getBoundingClientRect().top < window.innerHeight
              : false,
            hasH1: document.querySelectorAll("h1").length > 0,
            h1Count: document.querySelectorAll("h1").length,
          };

          const mailto = Array.from(
            document.querySelectorAll('a[href^="mailto:"]'),
          ).map((a) => a.getAttribute("href").replace(/^mailto:/, ""));
          const tel = Array.from(
            document.querySelectorAll('a[href^="tel:"]'),
          ).map((a) => a.getAttribute("href").replace(/^tel:/, ""));
          const emails = [
            ...new Set(
              [
                ...mailto,
                ...(text.match(
                  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
                ) || []),
              ].filter(Boolean),
            ),
          ].slice(0, 5);
          const phones = [
            ...new Set(
              [
                ...tel,
                ...(text.match(
                  /(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
                ) || []),
              ].filter(Boolean),
            ),
          ].slice(0, 5);

          const forms = Array.from(document.querySelectorAll("form"));
          const contactForm = forms.some((f) => {
            const sig = (
              f.getAttribute("action") +
              " " +
              f.id +
              " " +
              f.className
            ).toLowerCase();
            if (/contact|enquir|inquir|quote|lead/.test(sig)) return true;
            // Otherwise: a form with a message/textarea plus an email field.
            return (
              !!f.querySelector("textarea") &&
              !!f.querySelector('input[type="email"], input[name*="email" i]')
            );
          });
          const newsletter = forms.some((f) => {
            const sig = (f.id + " " + f.className).toLowerCase();
            return (
              /newsletter|subscribe|signup|mailing/.test(sig) ||
              /newsletter|subscribe/.test((f.innerText || "").toLowerCase())
            );
          });

          // A class containing "address" is not enough — on real pages it also
          // matches author bylines and email fields. Require the text to look
          // like a postal address: a street number and a postal/ZIP code.
          const looksPostal = (s) =>
            !!s &&
            /\d/.test(s) &&
            /\b\d{5}(?:-\d{4})?\b|\b[A-Z]\d[A-Z]/i.test(s);
          const addressCandidate = Array.from(
            document.querySelectorAll(
              'address, [itemtype*="PostalAddress"], [itemprop="address"], [class*="address" i]',
            ),
          )
            .map((el) => el.innerText?.trim().replace(/\s+/g, " "))
            .find(looksPostal);
          const addressMatch = text.match(
            /\d+\s+[\w.\s]{2,40},\s*[\w.\s]{2,30},\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/,
          );

          // Structured data is the only authoritative signal for these.
          let schemaTypes = [];
          let aggregateRating = null;
          let reviewCount = 0;
          for (const s of document.querySelectorAll(
            'script[type="application/ld+json"]',
          )) {
            try {
              const walk = (node) => {
                if (!node || typeof node !== "object") return;
                if (Array.isArray(node)) return node.forEach(walk);
                if (node["@type"])
                  schemaTypes.push(
                    ...[].concat(node["@type"]).map((t) => String(t)),
                  );
                if (node.aggregateRating && !aggregateRating) {
                  aggregateRating = {
                    ratingValue: node.aggregateRating.ratingValue ?? null,
                    reviewCount:
                      node.aggregateRating.reviewCount ??
                      node.aggregateRating.ratingCount ??
                      null,
                  };
                }
                if (node["@type"] === "Review") reviewCount += 1;
                Object.values(node).forEach(walk);
              };
              walk(JSON.parse(s.textContent));
            } catch {
              /* malformed JSON-LD is common; skip it */
            }
          }
          schemaTypes = [...new Set(schemaTypes)];

          // Count testimonial *containers*, not occurrences of the word.
          const testimonialEls = document.querySelectorAll(
            '[class*="testimonial" i], [id*="testimonial" i], [itemtype*="Review"], [class*="review-card" i], blockquote cite',
          );

          const ctaEls = Array.from(
            new Set(
              actionables
                .filter(
                  (a) =>
                    a.el.tagName === "BUTTON" ||
                    a.el.getAttribute("role") === "button" ||
                    /btn|cta|button/i.test(String(a.el.className)),
                )
                .map((a) => a.el),
            ),
          );

          return {
            valueProp,
            contact: {
              emails,
              phones,
              mailtoLinks: mailto.length,
              telLinks: tel.length,
              contactForm,
              address:
                addressCandidate?.slice(0, 200) || addressMatch?.[0] || null,
            },
            leadGeneration: {
              forms: forms.length,
              ctas: ctaEls.length,
              visibleCtas: ctaEls.filter(visible).length,
              newsletter,
              booking: anyLabel(
                /\b(book now|book a|schedule|appointment|reserve|get a quote|request a quote)\b/,
              ),
            },
            socialProof: {
              testimonialBlocks: testimonialEls.length,
              aggregateRating,
              schemaReviews: reviewCount,
              trustBadges: document.querySelectorAll(
                '[class*="badge" i] img, [class*="trust" i] img, [class*="accredit" i] img',
              ).length,
            },
            ecommerce: {
              // Structured data or a real cart link — not the word "shop".
              schemaProduct: schemaTypes.includes("Product"),
              cartLink: actionables.some(
                (a) =>
                  /\/(cart|basket|checkout)(\/|$|\?)/.test(a.href) ||
                  /\b(add to cart|add to bag|view cart|checkout)\b/.test(
                    a.label,
                  ),
              ),
              priceMarkup: !!document.querySelector(
                '[itemprop="price"], [class*="price" i]',
              ),
            },
            schemaTypes,
          };
        }),
      gotoOptions(),
    );
    business = await extractBusiness(url);
  } finally {
    await browserless.destroyContext();
  }
  const screenshotPath = path.join(outputDir, "business-screenshot.jpg");
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
      `Summarize the following business audit: ${JSON.stringify(business)}`,
    );
  }
  return {
    auditType: "business",
    business,
    screenshots: [screenshotPath],
    lmAnalysis,
  };
}
