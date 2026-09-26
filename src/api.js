import express from "express";
import cors from "cors";

import { checkDomainAvailability } from "./lib/domain-checker.js";
import domainsRouter from "./api/domains/domains-router.js";
import rankedRouter from "./api/ranked/ranked-router.js";
import keywordsRouter from "./api/keywords/keywords-router.js";
import synRouter from "./api/syn/syn-router.js";
import googledRouter from "./api/googled/googled-router.js";
import sitemapRouter from "./api/sitemap/sitemap-router.js";
import businessFinderRouter from "./api/business-finder/business-finder-router.js";
import authRouter from "./api/auth/auth-router.js";
import { authenticate, checkQuota, rateLimit } from "./api/auth/auth-module.js";
import { closeBrowser } from "./adapters/browser.js";
import { closeDb, databaseUrl } from "./store/db.js";

const app = express();
const port = Number(process.env.PORT || 3035);

app.use(express.json());
app.use(cors({ origin: true }));

// Unauthenticated: key issuance and confirmation, plus a liveness probe.
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/", authRouter);

app.use(authenticate);
app.use(rateLimit);
app.use(checkQuota);

app.get("/taken", async (req, res, next) => {
  try {
    res.json(await checkDomainAvailability(req.query.domain));
  } catch (error) {
    next(error);
  }
});

app.use("/", domainsRouter);
app.use("/", rankedRouter);
app.use("/", keywordsRouter);
app.use("/", synRouter);
app.use("/", googledRouter);
app.use("/", sitemapRouter);
app.use("/", businessFinderRouter);

// A scrape that throws should return JSON like everything else, not an
// HTML stack trace.
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message });
});

const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Database: ${databaseUrl()}`);
});

/** Close the browser and the database so the process can actually exit. */
async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down.`);
  server.close();
  await closeBrowser();
  await closeDb();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
