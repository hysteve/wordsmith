/**
 * The self-hosted process: HTTP API plus, by default, the job worker.
 *
 * They run together so there is one thing to start and one process holding the
 * database and the browser. Set WORDSMITH_WORKER=off to run the API alone and
 * the worker on its own machine (`node src/jobs/worker.js`) — which is what
 * you want once the scraping should happen from a residential IP while the
 * API sits somewhere else.
 */
import express from "express";
import cors from "cors";

import { checkDomainAvailability } from "@wordsmith/core/lib/domain-checker.js";
import domainsRouter from "./http/routes/domains.js";
import rankedRouter from "./http/routes/ranked.js";
import keywordsRouter from "./http/routes/keywords.js";
import synRouter from "./http/routes/syn.js";
import googledRouter from "./http/routes/googled.js";
import sitemapRouter from "./http/routes/sitemap.js";
import businessFinderRouter from "./http/routes/business-finder.js";
import jobsRouter from "./http/routes/jobs.js";
import dataRouter from "./http/routes/data.js";
import authRouter from "./http/routes/auth.js";
import {
  authenticate,
  checkQuota,
  rateLimit,
} from "@wordsmith/core/auth/api-keys.js";
import { closeBrowser } from "@wordsmith/core/adapters/browser.js";
import { closeDb, databaseUrl, db } from "@wordsmith/core/store/index.ts";
import { startWorker } from "./jobs/worker.js";

const app = express();
const port = Number(process.env.PORT || 3035);
const workerEnabled = process.env.WORDSMITH_WORKER !== "off";

app.use(express.json());
app.use(cors({ origin: true }));

// Unauthenticated: key issuance and confirmation, plus a liveness probe.
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/", authRouter);

app.use(authenticate);
app.use(rateLimit);
app.use(checkQuota);

// Asynchronous work, and reading what it measured.
app.use("/", jobsRouter);
app.use("/", dataRouter);

// Synchronous tools. These block for as long as the scrape takes, so they are
// for quick lookups; anything slow belongs behind a job.
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

// A scrape that throws should return JSON like everything else, not an HTML
// stack trace.
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message });
});

// Open and migrate before accepting traffic, so the first request doesn't
// race the migrator.
await db();

const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Database: ${databaseUrl()}`);
  console.log(`Worker: ${workerEnabled ? "in-process" : "off"}`);
});

const worker = workerEnabled ? startWorker() : null;

/** Let the current job finish, then release the browser and the database. */
async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down.`);
  server.close();
  if (worker) await worker.stop();
  await closeBrowser();
  await closeDb();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
