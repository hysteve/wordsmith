import express from "express";
import { extractQueryRankings } from "@wordsmith/core/scrapers/ranked.js";

const router = express.Router();

const MAX_PAGES = 5; // each page is another Google request; keep it bounded

router.get("/ranked", async (req, res, next) => {
  const { searchQuery, linkbacks = null, exclude = [] } = req.query;

  const pages = Number.parseInt(req.query.pages, 10);

  try {
    const { results } = await extractQueryRankings(searchQuery, {
      linkbacks,
      pages: Number.isFinite(pages)
        ? Math.min(Math.max(pages, 1), MAX_PAGES)
        : 1,
      exclude: Array.isArray(exclude) ? exclude : [exclude].filter(Boolean),
      // Screenshots write files to the server; not something a caller picks.
      screenshot: false,
    });
    res.json(results);
  } catch (error) {
    next(error);
  }
});

export default router;
