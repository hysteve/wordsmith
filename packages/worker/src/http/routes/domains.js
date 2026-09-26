import express from "express";
import { checkAndRecommend } from "@wordsmith/core/scrapers/domains.js";

const router = express.Router();

// Where the availability cache lives for HTTP callers. Deliberately not taken
// from the query string: it is a filesystem path the service writes to.
const CACHE_DIR = process.env.WORDSMITH_OUTPUT_DIR || "./output/";

const MAX_SUGGESTIONS = 50;
const MAX_TIMEOUT_MS = 120000;

function clamp(value, fallback, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

router.get("/domains", async (req, res, next) => {
  const { domain, categories } = req.query;
  if (!domain) return res.status(400).json({ error: "domain is required" });

  try {
    res.json(
      await checkAndRecommend(domain, {
        categories: categories ? categories.split(",") : [],
        maxSuggestions: clamp(req.query.suggestions, 10, MAX_SUGGESTIONS),
        maxTries: clamp(req.query.maxTries, 50, 500),
        timeout: clamp(req.query.timeout, 30000, MAX_TIMEOUT_MS),
        outputPath: CACHE_DIR,
      }),
    );
  } catch (error) {
    next(error);
  }
});

export default router;
