/**
 * The store's public surface: one connection, and typed repositories over it.
 *
 * Callers use repositories rather than reaching for the database handle, so
 * the rules that live in them — a blocked check is never written as an
 * absence, a run always has provenance — cannot be bypassed by accident.
 */
export {
  db,
  rawClient,
  closeDb,
  databaseUrl,
  schema,
  type Database,
} from "./db.ts";
export * as sites from "./repositories/sites.ts";
export * as runs from "./repositories/runs.ts";
export * as activity from "./repositories/activity.ts";
export * as jobs from "./repositories/jobs.ts";
export * as observations from "./repositories/observations.ts";
export * as apiKeys from "./repositories/api-keys.ts";
