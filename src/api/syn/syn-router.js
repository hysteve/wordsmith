import express from 'express';
import { extractSynonyms } from './syn-module.js';

const router = express.Router();

router.get('/syn', async (req, res) => {
  const { word, allWords = false, strength = null, wordType = null } = req.query;

  const options = {
    allWords: allWords === 'true',
    strength: strength ? parseInt(strength) : null,
    wordType
  };

  try {
    const result = await extractSynonyms(word, options);
    res.json(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

export default router;