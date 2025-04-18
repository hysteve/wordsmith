import express from "express";
import { sitemap } from "./sitemap-module.js";

const router = express.Router();

router.get("/sitemap", async (req, res) => {
  const { url } = req.query;
  const options = {
    command: req.query.command,
    crawl: req.query.crawl === "true",
  };

  try {
    const result = await sitemap(url, options);
    res.json(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

export default router;
