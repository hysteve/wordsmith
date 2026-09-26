/**
 * Suggest available domain variations around a base domain.
 *
 * This used to print its findings with chalk and return only the suggestion
 * list, so an HTTP caller lost the "is the base domain itself taken" answer
 * to the server's stdout. It now returns everything it learned and reports
 * progress through a callback, leaving presentation to the caller — the CLI
 * renders it in colour, the web UI can stream it.
 */
import path from "path";
import { checkDomainAvailability } from "../lib/domain-checker.js";
import {
  generateRandomDomain,
  updateCache,
  loadUnavailableDomains,
  loadAvailableDomains,
} from "../lib/domain-generator.js";

/**
 * @param {string} domain base domain; ".com" is assumed when no TLD is given
 * @param {object} options
 * @param {(event: {type: string, [k: string]: unknown}) => void} [options.onProgress]
 * @returns {Promise<{domain: string, available: boolean, suggestions: string[],
 *   tries: number, stoppedBecause: "complete"|"maxTries"|"timeout"}>}
 */
export async function checkAndRecommend(domain, options = {}) {
  const {
    categories,
    maxSuggestions = 10,
    maxTries = 50,
    timeout = 30000,
    outputPath = "./output/",
    onProgress = () => {},
  } = options;

  if (!domain.includes(".")) domain += ".com";

  const { available } = await checkDomainAvailability(domain);
  onProgress({ type: "base", domain, available });

  // Read and write the same files. These used to disagree: the loaders read
  // from `outputPath` while updateCache wrote to the working directory, so
  // the cache never survived a run.
  const unavailableFile = path.join(outputPath, "unavailable_domains.json");
  const availableFile = path.join(outputPath, "available_domains.json");
  const unavailableDomains = loadUnavailableDomains(outputPath);
  const availableDomains = loadAvailableDomains(outputPath);

  const suggestions = [];
  const startTime = Date.now();
  let tries = 0;
  let stoppedBecause = "complete";

  while (suggestions.length < maxSuggestions) {
    if (Date.now() - startTime >= timeout) {
      stoppedBecause = "timeout";
      break;
    }
    if (tries >= maxTries) {
      stoppedBecause = "maxTries";
      break;
    }

    const candidate = generateRandomDomain(
      domain.replace(/\..*$/, ""),
      categories,
    );
    if (unavailableDomains.has(candidate)) continue;
    tries++;

    if ((await checkDomainAvailability(candidate)).available) {
      if (availableDomains.has(candidate)) continue;
      suggestions.push(candidate);
      updateCache(candidate, availableFile, availableDomains);
      onProgress({
        type: "suggestion",
        domain: candidate,
        index: suggestions.length,
      });
    } else {
      updateCache(candidate, unavailableFile, unavailableDomains);
    }
  }

  onProgress({ type: "done", stoppedBecause, count: suggestions.length });
  return { domain, available, suggestions, tries, stoppedBecause };
}
