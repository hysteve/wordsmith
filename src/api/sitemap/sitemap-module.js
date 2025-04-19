import createBrowser from "browserless";
import { onExit } from "signal-exit";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create browser instance
const browser = createBrowser({ timeout: 120000 });
onExit(browser.close);

const defaultGotoOptions = {
  device: "macbook pro 13",
  waitUntil: "networkidle2", // Wait until network is idle
  adblock: true,
};

const getGotoOptions = (options = {}) => {
  return {
    ...defaultGotoOptions,
    ...options,
  };
};

// Helper function to create a unique set from an array
function deduplicate(array) {
  return [...new Set(array)];
}

// Helper to normalize URLs
function normalizeUrl(url, baseUrl) {
  try {
    // Handle relative URLs
    if (url.startsWith("/")) {
      const base = new URL(baseUrl);
      return `${base.protocol}//${base.host}${url}`;
    }

    // Handle URLs without protocol
    if (!url.startsWith("http") && !url.startsWith("//")) {
      const base = new URL(baseUrl);
      if (url.startsWith("./")) {
        url = url.substring(2);
      }
      return `${base.protocol}//${base.host}/${url}`;
    }

    // Handle protocol-relative URLs
    if (url.startsWith("//")) {
      const base = new URL(baseUrl);
      return `${base.protocol}${url}`;
    }

    return url;
  } catch (e) {
    return null; // Return null for invalid URLs
  }
}

// Function to categorize links
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
      // Skip javascript: links, mailto:, tel:, etc.
      if (
        !link.url ||
        link.url.startsWith("javascript:") ||
        link.url.startsWith("mailto:") ||
        link.url.startsWith("tel:") ||
        link.url === "#"
      ) {
        continue;
      }

      const url = new URL(link.url);

      // Categorize based on domain and link properties
      if (url.hostname === baseDomain) {
        if (link.isNavigation) {
          result.navigation.push(link);
        } else {
          result.internal.push(link);
        }
      } else {
        result.external.push(link);
      }
    } catch (e) {
      // Handle invalid URLs
      result.other.push({
        url: link.url,
        text: link.text,
        error: e.message,
      });
    }
  }

  return result;
}

// Main function to crawl a website
export async function crawlSite(url, options = {}) {
  const {
    maxPages = 10,
    maxDepth = 2,
    includeExternal = false,
    onProgress = null,
  } = options;

  const baseUrl = url.startsWith("http") ? url : `https://${url}`;
  const visited = new Set();
  const queue = [{ url: baseUrl, depth: 0 }];
  const allLinks = [];

  // Create a browserless context
  const browserlessContext = await browser.createContext();

  try {
    while (queue.length > 0 && visited.size < maxPages) {
      const { url: currentUrl, depth } = queue.shift();

      // Skip if already visited
      if (visited.has(currentUrl)) continue;

      console.log(
        `Crawling [${visited.size + 1}/${maxPages}]: ${currentUrl} (depth: ${depth})`,
      );
      if (onProgress) {
        onProgress(visited.size + 1, maxPages, currentUrl);
      }

      visited.add(currentUrl);

      // Extract links from the current page
      try {
        // Use browserless to navigate and extract links
        const getLinks = browserlessContext.evaluate(
          (page) =>
            page.evaluate(() => {
              // This function runs inside the browser context
              const extractedLinks = [];

              // Get all anchor elements
              const anchors = document.querySelectorAll("a[href]");

              // Process each anchor
              anchors.forEach((anchor) => {
                const href = anchor.href;
                const text = anchor.textContent.trim();
                console.log("anchor", anchor.href);

                // Determine if it's a navigation link
                const isNavElement = Boolean(
                  anchor.closest("nav") ||
                    anchor.closest("header") ||
                    anchor.closest('[role="navigation"]') ||
                    anchor.closest(".navbar") ||
                    anchor.closest(".menu") ||
                    anchor.closest(".navigation"),
                );

                // Check if text implies navigation
                const navKeywords = [
                  "home",
                  "about",
                  "contact",
                  "services",
                  "blog",
                ];
                const isNavText = navKeywords.some((keyword) =>
                  text.toLowerCase().includes(keyword),
                );

                extractedLinks.push({
                  url: href,
                  text: text,
                  isNavigation: isNavElement || isNavText,
                });
              });

              return extractedLinks;
            }),
          getGotoOptions(options),
        );

        const links = await getLinks(currentUrl);
        // Add these links to our collection
        if (links && Array.isArray(links)) {
          allLinks.push(...links);

          // Only add new pages to queue if depth allows
          if (depth < maxDepth) {
            for (const link of links) {
              try {
                // Skip if already visited or queued
                if (visited.has(link.url)) continue;

                // Only add internal links or external if specified
                const linkUrl = new URL(link.url);
                const baseDomain = new URL(baseUrl).hostname;

                if (
                  linkUrl.hostname === baseDomain ||
                  (includeExternal && !visited.has(link.url))
                ) {
                  queue.push({ url: link.url, depth: depth + 1 });
                }
              } catch (e) {
                // Skip invalid URLs
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error crawling ${currentUrl}:`, error.message);
      }
    }
  } finally {
    // Make sure to destroy the context when done
    await browserlessContext.destroyContext();
  }

  // Deduplicate links by URL
  const uniqueUrls = new Set();
  const uniqueLinks = allLinks.filter((link) => {
    if (uniqueUrls.has(link.url)) return false;
    uniqueUrls.add(link.url);
    return true;
  });

  // Categorize the links
  const categorized = categorizeLinks(uniqueLinks, baseUrl);

  return {
    baseUrl,
    crawledPages: Array.from(visited),
    totalCrawled: visited.size,
    totalLinks: uniqueLinks.length,
    ...categorized,
  };
}

// Helper for executing commands if needed
export async function executeCommand(command, url) {
  if (!command) return null;

  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    const { stdout, stderr } = await execAsync(command.replace("{url}", url));
    return { url, stdout, stderr };
  } catch (error) {
    return { url, error: error.message };
  }
}
