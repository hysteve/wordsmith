import express from 'express';
import { extractQueryRankings } from './ranked-module.js';

const router = express.Router();

router.get('/ranked', async (req, res) => {
  const { searchQuery, json = false, screenshot = false, linkbacks = null, pages = 1, exclude = [] } = req.query;

  const options = {
    json: json === 'true',
    screenshot: screenshot === 'true',
    linkbacks,
    pages: parseInt(pages),
    exclude: Array.isArray(exclude) ? exclude : [exclude]
  };

  try {
    const result = await extractQueryRankings(searchQuery, options);
    res.json(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

export default router;