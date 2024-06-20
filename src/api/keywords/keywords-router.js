import express from "express";
import { parseKeywords } from "./keywords-module.js";

const router = express.Router();

router.get("/keywords", async (req, res) => {
  const { url, minCount = 2 } = req.query;

  const options = {
    minCount: parseInt(minCount),
  };

  try {
    const result = await parseKeywords(url, options);
    res.json(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

export default router;
