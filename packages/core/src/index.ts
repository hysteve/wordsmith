/**
 * @wordsmith/core — the public surface.
 *
 * Two channels, because the halves have opposite runtime needs.
 *
 * **Channel A — pure logic.** Phrase normalization, the role ladder, the
 * containment lattice, the views and the report. No I/O, no network, no
 * Chrome; milliseconds. Re-exported here and importable on its own from
 * `@wordsmith/core/services/cloud-core.js`, which is the import a serverless
 * consumer should use — it pulls in nothing but this file.
 *
 * **Channel B — measurement.** The proposers, rankings, coverage and the audit
 * suite. These drive a real browser, are slow by design (Google is throttled
 * deliberately), and depend on the IP they run from. They are *not* re-exported
 * here, so that importing this module stays cheap. Reach them by subpath:
 *
 *   import { checkRankings } from "@wordsmith/core/services/cloud.js";
 *   import { runSEOAudit }   from "@wordsmith/core/audits/seo.js";
 *   import { browser }       from "@wordsmith/core/adapters/browser.js";
 *
 * The rule that keeps this honest: nothing in Channel A may import anything.
 * `services/cloud-core.test.js` asserts it.
 */

// Channel A — safe to import anywhere.
export * from "./services/cloud-core.js";

// Where the data lives. Cheap, and every consumer needs to agree on it.
export {
  workspaceRoot,
  dataDir,
  cloudsDir,
  outputDir,
  ensureDir,
} from "./paths.ts";
