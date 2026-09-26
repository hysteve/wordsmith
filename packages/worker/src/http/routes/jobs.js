/**
 * The job API: enqueue work, watch it, read the result.
 *
 * This is the shape the web UI talks to. Nothing here blocks on a scrape — an
 * audit is minutes of browser time, so the client gets a job id immediately
 * and either polls /jobs/:id or streams /jobs/:id/events.
 */
import express from "express";
import { jobs } from "@wordsmith/core/store/index.ts";
import { JOB_KINDS } from "../../jobs/handlers/index.js";

const router = express.Router();

router.get("/jobs/kinds", (_req, res) => res.json({ kinds: JOB_KINDS }));

router.post("/jobs", async (req, res, next) => {
  const { kind, payload = {}, priority, maxAttempts, delayMs } = req.body || {};

  if (!JOB_KINDS.includes(kind)) {
    return res.status(400).json({
      error: `Unknown job kind "${kind}"`,
      kinds: JOB_KINDS,
    });
  }

  try {
    const job = await jobs.enqueue(kind, payload, {
      priority,
      maxAttempts,
      delayMs,
    });
    res.status(202).json(job);
  } catch (error) {
    next(error);
  }
});

router.get("/jobs", async (req, res, next) => {
  try {
    res.json(
      await jobs.listJobs({
        status: req.query.status,
        kind: req.query.kind,
        limit: Math.min(Number(req.query.limit) || 50, 200),
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/jobs/:id", async (req, res, next) => {
  try {
    const job = await jobs.getJob(Number(req.params.id));
    if (!job) return res.status(404).json({ error: "No such job" });
    res.json(job);
  } catch (error) {
    next(error);
  }
});

router.post("/jobs/:id/cancel", async (req, res, next) => {
  try {
    const cancelled = await jobs.cancelJob(Number(req.params.id));
    if (!cancelled) {
      // A running job owns a browser context; it has to finish or fail.
      return res
        .status(409)
        .json({ error: "Only a job that has not started can be cancelled" });
    }
    res.json({ cancelled: true });
  } catch (error) {
    next(error);
  }
});

const TERMINAL = new Set(["done", "failed", "cancelled"]);

/**
 * Server-sent events for one job, so a UI can show progress without polling.
 * Closes itself once the job reaches a terminal state.
 */
router.get("/jobs/:id/events", async (req, res) => {
  const id = Number(req.params.id);

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // don't let a proxy sit on the stream
  });
  res.flushHeaders?.();

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  let lastSent = null;
  while (!closed) {
    let job;
    try {
      job = await jobs.getJob(id);
    } catch (error) {
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`,
      );
      break;
    }

    if (!job) {
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: "No such job" })}\n\n`,
      );
      break;
    }

    // Only send when something actually changed.
    const snapshot = JSON.stringify({
      status: job.status,
      progress: job.progress,
      attempts: job.attempts,
    });
    if (snapshot !== lastSent) {
      res.write(`data: ${JSON.stringify(job)}\n\n`);
      lastSent = snapshot;
    }

    if (TERMINAL.has(job.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  res.end();
});

export default router;
