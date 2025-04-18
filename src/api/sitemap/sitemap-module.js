import createBrowser from "browserless";
import { onExit } from "signal-exit";
import path from "path";
import { fileURLToPath } from "url";
import { parseStringPromise } from "xml2js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const browser = createBrowser({ timeout: 120000, adblock: false });
onExit(await browser.close);

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

async function findSitemap(url) {
  const browserless = await browser.createContext();
  const sitemapLinks = browserless.evaluate(async (page) => {
    await page.setViewport({ width: 500, height: 600 });
    await page.waitForSelector("body", { visible: true, timeout: 4000 });
    return page.evaluate(() => {
      const atags = [];
      const atagsHandle = Array.from(document.querySelectorAll("a[href]"));
      for (const atag of atagsHandle) {
        atags.push({
          url: atag.href,
          content: atag.textContent,
          isInternal: new URL(atag.href).hostname === new URL(url).hostname,
          isOpenNewPage: atag.target === "_blank",
        });
      }
      return atags;
      // const buttons = [];
      // const btagsHandle = Array.from(document.querySelectorAll("button"));
      // for (const btn of btagsHandle) {
      //   buttons.push({
      //     type: btn.type,
      //     content: btn.textContent,
      //     disabled: btn.disabled,
      //   });
      // }
      // result.atags = atags;
      // result.buttons = buttons;
    });
  });
  return await sitemapLinks({ url });
}
// async function findSitemap(url) {
//   const browserless = await browser.createContext();
//   try {
//     // Try common sitemap locations
//     const sitemapUrls = [
//       `${url}/sitemap.xml`,
//       `${url}/sitemap_index.xml`,
//       `${url}/sitemap-index.xml`,
//       `${url}/sitemap.txt`,
//     ];

//     for (const sitemapUrl of sitemapUrls) {
//       try {
//         const response = await browserless.html(sitemapUrl);
//         console.log(response);
//         if (response) {
//           return { url: sitemapUrl, content: response };
//         }
//       } catch (e) {
//         // Continue to next URL
//       }
//     }

//     // If no sitemap found, try to find it in robots.txt
//     try {
//       const robotsTxt = await browserless.text(`${url}/robots.txt`);
//       const sitemapMatch = robotsTxt.match(/Sitemap:\s*(.*)/i);
//       if (sitemapMatch) {
//         const sitemapUrl = sitemapMatch[1].trim();
//         const content = await browserless.text(sitemapUrl);
//         return { url: sitemapUrl, content };
//       }
//     } catch (e) {
//       // Continue
//     }

//     throw new Error("No sitemap found");
//   } finally {
//     await browserless.destroyContext();
//   }
// }

// async function parseSitemap(content) {
//   try {
//     // Try parsing as XML
//     const result = await parseStringPromise(content);
//     if (result.urlset && result.urlset.url) {
//       return result.urlset.url.map((url) => url.loc[0]);
//     }
//     if (result.sitemapindex && result.sitemapindex.sitemap) {
//       return result.sitemapindex.sitemap.map((sitemap) => sitemap.loc[0]);
//     }
//   } catch (e) {
//     // If not XML, try parsing as text
//     return content
//       .split("\n")
//       .map((line) => line.trim())
//       .filter((line) => line && line.startsWith("http"));
//   }
// }

function categorizeLinks(links, baseUrl) {
  const baseDomain = new URL(baseUrl).hostname;
  const result = {
    internal: [],
    navigation: [],
    external: [],
    other: [],
  };

  for (const link of links) {
    try {
      const url = new URL(link);
      if (url.hostname === baseDomain) {
        if (url.pathname === "/" || url.pathname === "") {
          result.navigation.push(link);
        } else {
          result.internal.push(link);
        }
      } else {
        result.external.push(link);
      }
    } catch (e) {
      result.other.push(link);
    }
  }

  return result;
}

async function executeCommand(command, url) {
  try {
    const { stdout, stderr } = await execAsync(command.replace("{url}", url));
    return { url, stdout, stderr };
  } catch (error) {
    return { url, error: error.message };
  }
}

export async function sitemap(url, options = {}) {
  const { command, crawl = false } = options;
  const baseUrl = url.startsWith("http") ? url : `https://${url}`;
  // const sitemap

  // Find and parse sitemap
  // const { url: sitemapUrl, content } = await findSitemap(baseUrl);
  const links = await findSitemap(baseUrl);
  console.log("links:", links);

  // Categorize links
  const categorized = categorizeLinks(
    links.map((link) => link.url),
    baseUrl,
  );

  // Execute command on each link if specified
  if (command) {
    const results = await Promise.all(
      links.map((link) => executeCommand(command, link)),
    );
    categorized.commandResults = results;
  }

  // Crawl each link if requested
  if (crawl) {
    const browserless = await browser.createContext();
    try {
      const crawlResults = await Promise.all(
        links.map(async (link) => {
          try {
            const text = await browserless.text(link);
            return { url: link, success: true, content: text };
          } catch (error) {
            return { url: link, success: false, error: error.message };
          }
        }),
      );
      categorized.crawlResults = crawlResults;
    } finally {
      await browserless.destroyContext();
    }
  }

  return {
    sitemapUrl: url,
    totalLinks: links.length,
    ...categorized,
  };
}
