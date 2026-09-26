/**
 * Load the workspace's .env, once, from a fixed location.
 *
 * Four modules each called `dotenv.config()`, which resolves `.env` against
 * the current working directory. That worked only when the process happened
 * to start at the repo root: `pnpm start` runs from packages/worker, so the
 * master key silently went missing and every admin request became Forbidden.
 *
 * Importing this module for its side effect is enough:
 *   import "../env.ts";
 */
import dotenv from "dotenv";
import path from "node:path";
import { workspaceRoot } from "./paths.ts";

// Values already in the environment win, so a real deployment can override.
dotenv.config({ path: path.join(workspaceRoot, ".env") });
dotenv.config({ path: path.join(workspaceRoot, ".env.defaults") });

export {};
