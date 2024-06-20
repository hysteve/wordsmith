import express from "express";
import { checkAndRecommend } from "./domains-module.js";

const router = express.Router();

router.get("/domains", async (req, res) => {
  const {
    domain,
    categories,
    suggestions = 10,
    maxTries = 50,
    timeout = 30000,
    outputPath = "./output/",
    useSynonyms = false,
    useSameStart = false,
    useTriggers = false,
    useFollowers = false,
    useFollowSuffix = false,
  } = req.query;

  let categoriesList = categories ? categories.split(",") : [];

  const options = {
    categories: categoriesList,
    maxSuggestions: parseInt(suggestions),
    maxTries: parseInt(maxTries),
    timeout: parseInt(timeout),
    outputPath,
    useSynonyms: useSynonyms === "true",
    useSameStart: useSameStart === "true",
    useTriggers: useTriggers === "true",
    useFollowers: useFollowers === "true",
    useFollowSuffix: useFollowSuffix === "true",
  };

  try {
    const result = await checkAndRecommend(domain, options);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

export default router;
