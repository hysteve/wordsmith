import { existsSync, readFileSync, writeFileSync } from "fs";
import { randomInt } from "crypto";
import tlds from "../data/tlds.js";
import categoryPrefixes from "../data/prefixes.js";
import categorySuffixes from "../data/suffixes.js";
import path from "path";

function randomElement(array) {
  if (!array.length) return '';
  return array[Math.floor(randomInt(0, array.length))];
}

function randomTLD() {
  const roll = Math.random();
  let cumulative = 0;
  for (const [tld, probability] of Object.entries(tlds)) {
    cumulative += probability;
    if (roll < cumulative) {
      return tld;
    }
  }
  return ".com"; // Default fallback
}

function generateRandomDomain(base, categories, outputPath = './') {
  const prefixCategory = randomElement(categories);
  const suffixCategory = randomElement(categories);
  const prefix =
    Math.random() < 0.5
      ? randomElement(
          categoryPrefixes[prefixCategory] || categoryPrefixes["default"]
        )
      : "";
  const suffix =
    Math.random() < 0.5
      ? randomElement(
          categorySuffixes[suffixCategory] || categorySuffixes["default"]
        )
      : "";
  const tld = randomTLD();
  return `${prefix}${base}${suffix}${tld}`;
}

function loadCache(file) {
  if (existsSync(file)) {
    return new Set(JSON.parse(readFileSync(file, "utf8")));
  }
  return new Set();
}

const loadUnavailableDomains = (outputPath) =>  loadCache(path.join(outputPath, "/unavailable_domains.json"));
const loadAvailableDomains = (outputPath) => loadCache(path.join(outputPath, "/available_domains.json"));

function updateCache(domain, file, cache) {
  cache.add(domain);
  writeFileSync(file, JSON.stringify([...cache]), "utf8");
}

export {
  generateRandomDomain,
  updateCache,
  loadUnavailableDomains,
  loadAvailableDomains,
};
