/**
 * One timestamp format for the whole store.
 *
 * Columns default to SQLite's `datetime('now')`, which is `YYYY-MM-DD HH:MM:SS`
 * in UTC. Writing `new Date().toISOString()` into the same column produces
 * `YYYY-MM-DDTHH:MM:SS.sssZ` instead, and because these are compared as text,
 * the two formats do not order against each other: 'T' sorts after ' ', so an
 * ISO timestamp always looks *later* than a SQLite one.
 *
 * That is not cosmetic. The job queue claims work with
 * `run_after <= datetime('now')`, so an ISO `run_after` was never eligible and
 * no job ever ran.
 */

/** A Date as SQLite writes it: `YYYY-MM-DD HH:MM:SS`, UTC. */
export function sqliteTime(date: Date = new Date()): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/** Read one back. The stored text is UTC, which `Date` will not assume. */
export function parseSqliteTime(value: string): Date {
  if (!value) return new Date(NaN);
  // Already ISO (legacy rows) — trust it.
  if (value.includes("T")) return new Date(value);
  return new Date(`${value.replace(" ", "T")}Z`);
}
