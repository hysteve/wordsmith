import express from "express";
import { crawlSite } from "./sitemap-module.js";

const router = express.Router();

const MAX_PAGES = 100; // a crawl over HTTP shouldn't be able to run forever
const MAX_DEPTH = 5;

function clamp(value, fallback, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

router.get("/sitemap", async (req, res, next) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url is required" });

  // Note: the CLI's `--command` option is deliberately absent here. It runs
  // arbitrary shell commands, so it stays in the CLI. See src/scripts/sitemap.js.
  try {
    res.json(
      await crawlSite(url, {
        maxPages: clamp(req.query.maxPages, 10, MAX_PAGES),
        maxDepth: clamp(req.query.maxDepth, 2, MAX_DEPTH),
        includeExternal: req.query.includeExternal === "true",
      }),
    );
  } catch (error) {
    next(error);
  }
});

export default router;
