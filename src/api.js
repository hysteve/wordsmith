import express from 'express';
import domainsRoute from './routes/domains/domains-route.js';
import rankedRoute from './routes/ranked/ranked-route.js';
import keywordsRoute from './routes/keywords/keywords-route.js';
import { checkDomainAvailability } from './lib/domain-checker.js';
const app = express();
const port = 3035;

const getSynonyms = (word, options) => {
  // Implement the logic to get synonyms from Thesaurus.com here
  return `Getting synonyms for ${word} with options: ${JSON.stringify(options)}`;
};

const getGoogleCompletions = (phrase, options) => {
  // Implement the logic to get completions for a search query from Google here
  return `Getting completions for ${phrase} with options: ${JSON.stringify(options)}`;
};

app.use(express.json());

// Endpoint for 'taken'
app.get('/taken', async (req, res) => {
  const { domain } = req.query;
  const result = await checkDomainAvailability(domain);
  res.send(result);
});

// Routes
app.use('/', domainsRoute);
app.use('/', rankedRoute);
app.use('/', keywordsRoute);

// Endpoint for 'syn'
app.get('/syn', (req, res) => {
  const { word } = req.query;
  const options = {
    allWords: req.query.allWords || false,
    pretty: req.query.pretty || false,
    strength: req.query.strength || null,
    wordType: req.query.wordType || null
  };
  const result = getSynonyms(word, options);
  res.send(result);
});

// Endpoint for 'googled'
app.get('/googled', (req, res) => {
  const { phrase } = req.query;
  const options = {
    ads: req.query.ads || false,
    cascade: req.query.cascade || false,
    json: req.query.json || false,
    delay: req.query.delay || 2000,
    screenshot: req.query.screenshot || false
  };
  const result = getGoogleCompletions(phrase, options);
  res.send(result);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});