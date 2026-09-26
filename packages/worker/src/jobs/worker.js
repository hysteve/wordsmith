/**
 * The job runner.
 *
 * Claims one job at a time and runs it to completion. Serial on purpose:
 * every handler here drives the single shared browser, and running two
 * scrapes at once against Google is the fastest way to get `blocked` for
 * both. Throughput is not the constraint; not being throttled is.
 *
 * Runs in-process with the HTTP server by default (one thing to deploy), or
 * standalone via `node src/jobs/worker.js` when it should have its own
 * machine.
 */
import {
  jobs as jobsRepo,
  runs as runsRepo,
} from "@wordsmith/core/store/index.ts";
import { closeBrowser } from "@wordsmith/core/adapters/browser.js";
import { handlers } from "./handlers/index.js";

const IDLE_POLL_MS = Number(process.env.WORDSMITH_WORKER_POLL_MS || 2000);
/** Release the browser after a quiet spell rather than holding Chrome open. */
const IDLE_BROWSER_RELEASE_MS = Number(
  process.env.WORDSMITH_WORKER_BROWSER_IDLE_MS || 60000,
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Run a single claimed job inside a run record, and store its outcome. */
export async function runJob(job, { log = console } = {}) {
  const handler = handlers[job.kind];
  if (!handler) {
    await jobsRepo.failJob(job.id, `No handler for job kind "${job.kind}"`);
    return { ok: false, reason: "no-handler" };
  }

  const payload =
    typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;

  // Every job gets a run, so its measurements have provenance even if the
  // handler throws halfway through.
  const run = await runsRepo.startRun({
    tool: job.kind,
    target: payload?.url ?? payload?.target ?? payload?.seed ?? null,
    params: payload,
    jobId: job.id,
  });

  const ctx = {
    runId: run.id,
    jobId: job.id,
    progress: (text) => jobsRepo.reportProgress(job.id, text).catch(() => {}),
  };

  try {
    const result = await handler(payload, ctx);
    await runsRepo.finishRun(run.id);
    await jobsRepo.completeJob(job.id, result);
    log.log(`job ${job.id} (${job.kind}) done`);
    return { ok: true, result };
  } catch (error) {
    await runsRepo.failRun(run.id, error);
    const retrying = await jobsRepo.failJob(job.id, error);
    log.error(
      `job ${job.id} (${job.kind}) failed: ${error.message}${retrying ? " — will retry" : ""}`,
    );
    return { ok: false, error, retrying };
  }
}

/**
 * Poll for work until stopped. Returns a handle with `stop()`, which lets the
 * current job finish rather than killing it mid-scrape.
 */
export function startWorker({ kinds, log = console } = {}) {
  let running = true;
  let idleSince = Date.now();

  const loop = (async () => {
    const stranded = await jobsRepo.requeueStranded();
    if (stranded)
      log.log(`requeued ${stranded} job(s) left running by a previous worker`);
    log.log("worker started");

    while (running) {
      let job;
      try {
        job = await jobsRepo.claimNext(kinds);
      } catch (error) {
        log.error(`worker could not claim: ${error.message}`);
        await sleep(IDLE_POLL_MS);
        continue;
      }

      if (!job) {
        // Nothing to do. Don't sit on a Chrome process while idle.
        if (Date.now() - idleSince > IDLE_BROWSER_RELEASE_MS) {
          await closeBrowser();
          idleSince = Date.now();
        }
        await sleep(IDLE_POLL_MS);
        continue;
      }

      idleSince = Date.now();
      await runJob(job, { log });
    }

    log.log("worker stopped");
  })();

  return {
    async stop() {
      running = false;
      await loop;
      await closeBrowser();
    },
  };
}

// Standalone mode: `node src/jobs/worker.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  const worker = startWorker();
  const shutdown = async (signal) => {
    console.log(`\n${signal} received; finishing the current job.`);
    await worker.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}
