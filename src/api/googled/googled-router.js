import express from 'express';
import { extractQueryCompletions } from './googled-module.js';

const router = express.Router();

router.get('/googled', async (req, res) => {
  const { phrase, cascade = false, delay = 1000 } = req.query;

  const options = {
    cascade: cascade === 'true',
    delay: parseInt(delay),
  };

  try {
    const result = await extractQueryCompletions(phrase, options);
    res.json(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

export default router;