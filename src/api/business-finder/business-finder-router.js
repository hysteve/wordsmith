import express from "express";
import { businessFinder } from "./business-finder-module.js";

const router = express.Router();

router.get("/business-finder", async (req, res) => {
  const options = {
    terms: req.query.terms,
    location: req.query.location,
    latitude: req.query.latitude,
    longitude: req.query.longitude,
    radius: req.query.radius ? parseInt(req.query.radius) : undefined,
    getDetails: req.query.details === "true",
    batchSize: req.query.batchSize ? parseInt(req.query.batchSize) : undefined,
  };

  try {
    const result = await businessFinder("", options);
    res.json(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

export default router;
