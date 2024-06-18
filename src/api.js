import express from "express";
import { checkDomainAvailability } from "./lib/domain-checker.js";
import domainsRouter from "./api/domains/domains-router.js";
import rankedRouter from "./api/ranked/ranked-router.js";
import keywordsRouter from "./api/keywords/keywords-router.js";
import synRouter from "./api/syn/syn-router.js";
import googledRouter from "./api/googled/googled-router.js";
import authRouter from "./api/auth/auth-router.js";
import { authenticate } from "./api/auth/auth-module.js";

const app = express();
const port = 3035;

app.use(express.json());

app.use('/', authRouter); // Exclude from auth

app.use(authenticate);

// Routes
app.get("/taken", async (req, res) => {
  const { domain } = req.query;
  const result = await checkDomainAvailability(domain);
  res.send(result);
});
app.use("/", domainsRouter);
app.use("/", rankedRouter);
app.use("/", keywordsRouter);
app.use("/", synRouter);
app.use("/", googledRouter);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
