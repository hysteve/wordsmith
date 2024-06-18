import chalk from "chalk";
import { checkDomainAvailability } from "../../lib/domain-checker.js";
import {
  generateRandomDomain,
  updateCache,
  loadUnavailableDomains,
  loadAvailableDomains,
} from "../../lib/domain-generator.js";

export async function checkAndRecommend(domain, options) {
  const {
    categories,
    maxSuggestions,
    maxTries,
    timeout,
    outputPath,
    // useSynonyms,
    // useSameStart,
    // useTriggers,
    // useFollowers,
    // useFollowSuffix,
  } = options;

  if (!domain.includes(".")) {
    domain += ".com";
  }

  const suggestions = [];
  let tries = -1;
  const startTime = Date.now();

  if ((await checkDomainAvailability(domain)).available) {
    console.log(chalk.green(`Available: `) + domain);
  } else {
    console.log(chalk.red(`Unavailable: ${domain}`));
    console.log(chalk.green(`Available Variations:`));
  }

  const unavailableDomains = loadUnavailableDomains(outputPath);
  const availableDomains = loadAvailableDomains(outputPath);

  while (
    suggestions.length < maxSuggestions &&
    Date.now() - startTime < timeout
  ) {
    if (tries >= maxTries) {
      console.log(
        chalk.red(
          "Maximum number of tries reached without fulfilling all suggestions.",
        ),
      );
      break;
    }

    const randomDomain = generateRandomDomain(
      domain.replace(/\..*$/, ""),
      categories,
    );
    if (unavailableDomains.has(randomDomain)) continue;
    tries++;

    let availability = await checkDomainAvailability(randomDomain);
    if (availability.available) {
      if (!availableDomains.has(randomDomain)) {
        suggestions.push(randomDomain);
        console.log(`  ${suggestions.length}. ${randomDomain}`);
        updateCache(randomDomain, "./available_domains.json", availableDomains);
      }
    } else {
      updateCache(
        randomDomain,
        "./unavailable_domains.json",
        unavailableDomains,
      );
    }
  }

  if (suggestions.length === 0) {
    console.log(
      chalk.yellow(
        "No new available domains were found. This might be a high-value domain area.",
      ),
    );
  } else {
    console.log(chalk.green("Domain checking complete."));
  }
  
  return suggestions;
}
