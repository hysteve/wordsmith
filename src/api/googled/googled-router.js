import express from 'express';
import { extractQueryCompletions } from './googled-module.js';

const MAX_LIMIT_RESULTS = 20;

const router = express.Router();

router.get('/googled', async (req, res) => {
  const { phrase, cascade = false, delay = 1000, limit = 5 } = req.query;
  console.log(limit);

  const options = {
    cascade: cascade === 'true',
    delay: parseInt(delay),
    limit: limit > MAX_LIMIT_RESULTS ? MAX_LIMIT_RESULTS : limit
  };

  try {
    const result = await extractQueryCompletions(decodeURIComponent(phrase), options);
    res.json(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

export default router;