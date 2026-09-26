/**
 * Reading what was measured.
 *
 * The write side is jobs; this is the read side the instrument panel renders.
 * Every response keeps the `quality` qualifier that rides with an observation,
 * so a client can draw a gap for a blocked check instead of a zero.
 */
import express from "express";
import { sites, runs, observations } from "@wordsmith/core/store/index.ts";

const router = express.Router();

router.get("/sites", async (_req, res, next) => {
  try {
    res.json(await sites.listSites());
  } catch (error) {
    next(error);
  }
});

router.get("/runs", async (req, res, next) => {
  try {
    res.json(
      await runs.recentRuns(Math.min(Number(req.query.limit) || 50, 200)),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/runs/:id", async (req, res, next) => {
  try {
    const run = await runs.getRun(Number(req.params.id));
    if (!run) return res.status(404).json({ error: "No such run" });
    res.json(run);
  } catch (error) {
    next(error);
  }
});

/** The trend for one phrase. */
router.get("/rankings/history", async (req, res, next) => {
  const { phrase, site, since } = req.query;
  if (!phrase) return res.status(400).json({ error: "phrase is required" });

  try {
    const siteRow = site ? await sites.siteFor(site) : null;
    res.json(
      await observations.rankHistory(phrase, {
        siteId: siteRow?.id,
        since,
        limit: Math.min(Number(req.query.limit) || 500, 2000),
      }),
    );
  } catch (error) {
    next(error);
  }
});

/** Where a site currently stands, one row per phrase. */
router.get("/rankings/latest", async (req, res, next) => {
  const { site } = req.query;
  if (!site) return res.status(400).json({ error: "site is required" });

  try {
    const siteRow = await sites.siteFor(site);
    const phrases = req.query.phrases
      ? String(req.query.phrases)
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
      : undefined;
    res.json(await observations.latestRanks(siteRow.id, phrases));
  } catch (error) {
    next(error);
  }
});

/** Who else keeps appearing for a phrase. */
router.get("/serp/competitors", async (req, res, next) => {
  const { phrase } = req.query;
  if (!phrase) return res.status(400).json({ error: "phrase is required" });

  try {
    res.json(
      await observations.serpCompetitors(
        phrase,
        Math.min(Number(req.query.limit) || 20, 100),
      ),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/audits", async (req, res, next) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url is required" });

  try {
    res.json(await observations.latestAudits(url));
  } catch (error) {
    next(error);
  }
});

export default router;
