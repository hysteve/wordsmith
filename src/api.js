import express from "express";
import { checkDomainAvailability } from "./lib/domain-checker.js";
import domainsRoute from "./routes/domains/domains-route.js";
import rankedRoute from "./routes/ranked/ranked-route.js";
import keywordsRoute from "./routes/keywords/keywords-route.js";
import synRoute from "./routes/syn/syn-route.js";
import googledRoute from "./routes/googled/googled-route.js";

const app = express();
const port = 3035;

app.use(express.json());

// Endpoint for 'taken'
app.get("/taken", async (req, res) => {
  const { domain } = req.query;
  const result = await checkDomainAvailability(domain);
  res.send(result);
});

// Routes
app.use("/", domainsRoute);
app.use("/", rankedRoute);
app.use("/", keywordsRoute);
app.use("/", synRoute);
app.use("/", googledRoute);

// Endpoint for 'googled'
app.get("/googled", (req, res) => {
  const { phrase } = req.query;
  const options = {
    ads: req.query.ads || false,
    cascade: req.query.cascade || false,
    json: req.query.json || false,
    delay: req.query.delay || 2000,
    screenshot: req.query.screenshot || false,
  };
  const result = getGoogleCompletions(phrase, options);
  res.send(result);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
