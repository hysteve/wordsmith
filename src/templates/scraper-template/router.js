import express from "express";
import { scrape } from "./module.js";

const router = express.Router();

router.get("/scrape", async (req, res) => {
  const { url } = req.query;
  const options = req.query;

  try {
    const result = await scrape(url, options);
    res.json(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

export default router;
