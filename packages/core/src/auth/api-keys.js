/**
 * API key auth: issue a key, confirm it by email link, check it on every
 * request, and meter usage.
 *
 * Three things were wrong with the previous version, recorded so they don't
 * come back:
 *
 *   1. It referenced a `keystore` object that no longer existed anywhere in
 *      the file. The module failed to link, which took the whole server down
 *      at startup — `npm start` could not boot at all.
 *   2. `createKey` stored a bcrypt hash while `authenticate` looked keys up
 *      with `WHERE hashed_key = ?` against the raw key. bcrypt is salted, so
 *      that comparison could never match and no key could ever authenticate.
 *      Lookup needs a deterministic hash; a 256-bit random key doesn't need
 *      stretching, so it's a plain SHA-256 now.
 *   3. Redis was connected with a top-level await, so the server refused to
 *      boot without it — in order to cache reads from a local database that
 *      are already faster than the network round trip. It's gone.
 */
import crypto from "crypto";
import { differenceInMonths } from "date-fns";
import "../env.ts";
import { db } from "../store/db.ts";


const MASTER_KEY = process.env.WORDSMITH_MASTER_KEY;
const CREDITS_PER_MONTH = 1000;
const PREMIUM_MAX_MONTHS = 3; // premium may bank up to three months of credit

export const STATUS = Object.freeze({
  REVOKED: -1,
  UNCONFIRMED: 0,
  ACTIVE: 1,
});

/** Deterministic so a key can be looked up by its value. */
export function hashKey(rawKey) {
  return crypto.createHash("sha256").update(String(rawKey)).digest("hex");
}

async function findByRawKey(rawKey) {
  if (!rawKey) return undefined;
  const conn = await db();
  const { rows } = await conn.execute({
    sql: "SELECT * FROM api_keys WHERE key_hash = ?",
    args: [hashKey(rawKey)],
  });
  return rows[0];
}

function isMaster(req) {
  return Boolean(MASTER_KEY) && req.headers["x-master-key"] === MASTER_KEY;
}

// --- middleware ------------------------------------------------------------

export async function authenticate(req, res, next) {
  try {
    const record = await findByRawKey(req.headers["x-api-key"]);

    if (!record) return res.status(403).json({ error: "Invalid API key" });
    if (record.status === STATUS.REVOKED)
      return res.status(403).json({ error: "API key revoked" });
    if (record.status !== STATUS.ACTIVE)
      return res.status(403).json({ error: "API key not confirmed" });

    const conn = await db();
    await conn.execute({
      sql: "UPDATE api_keys SET last_accessed = datetime('now') WHERE id = ?",
      args: [record.id],
    });

    req.apiKey = record; // downstream middleware reuses this instead of re-reading
    next();
  } catch (error) {
    next(error);
  }
}

const rateLimits = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 60;

export function rateLimit(req, res, next) {
  const key = req.headers["x-api-key"];
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry || now - entry.startTime >= RATE_WINDOW_MS) {
    rateLimits.set(key, { count: 1, startTime: now });
    return next();
  }
  if (entry.count >= MAX_PER_WINDOW)
    return res.status(429).json({ error: "Rate limit exceeded" });

  entry.count += 1;
  next();
}

/**
 * Monthly request credits. Free keys reset each month; premium keys bank
 * unused credit up to PREMIUM_MAX_MONTHS.
 */
export async function checkQuota(req, res, next) {
  try {
    const record = req.apiKey || (await findByRawKey(req.headers["x-api-key"]));
    if (!record) return res.status(403).json({ error: "Invalid API key" });

    const months = differenceInMonths(
      new Date(),
      new Date(record.period_start),
    );
    const isPremium = record.role === "premium";

    let count = record.request_count;
    let periodStart = record.period_start;

    if (months >= 1) {
      // A new period started. Free keys reset; premium keys carry the balance
      // forward against a larger allowance.
      count = isPremium ? Math.max(0, count - CREDITS_PER_MONTH * months) : 0;
      periodStart = new Date().toISOString();
    }

    const allowance = isPremium
      ? Math.min(
          (months + 1) * CREDITS_PER_MONTH,
          PREMIUM_MAX_MONTHS * CREDITS_PER_MONTH,
        )
      : record.request_limit || CREDITS_PER_MONTH;

    if (count >= allowance)
      return res.status(429).json({ error: "Request credit quota exceeded" });

    const conn = await db();
    await conn.execute({
      sql: "UPDATE api_keys SET request_count = ?, period_start = ? WHERE id = ?",
      args: [count + 1, periodStart, record.id],
    });

    next();
  } catch (error) {
    next(error);
  }
}

export function featureAccess(roleRequired) {
  return async (req, res, next) => {
    try {
      const record =
        req.apiKey || (await findByRawKey(req.headers["x-api-key"]));
      if (!record || record.status !== STATUS.ACTIVE)
        return res.status(403).json({ error: "API key inactive or invalid" });
      if (record.role !== roleRequired)
        return res
          .status(403)
          .json({ error: `Insufficient access: ${roleRequired} required` });
      next();
    } catch (error) {
      next(error);
    }
  };
}

// --- key lifecycle ---------------------------------------------------------

/** Issue an inactive key. Admin only; activated via the confirmation link. */
export async function createKey(req, res, next) {
  const { email } = req.body || {};
  if (!isMaster(req) || !email)
    return res.status(403).json({ error: "Forbidden" });

  const apiKey = crypto.randomBytes(32).toString("hex");

  try {
    const conn = await db();
    await conn.execute({
      sql: "INSERT INTO api_keys (email, key_hash, status) VALUES (?, ?, ?)",
      args: [email, hashKey(apiKey), STATUS.UNCONFIRMED],
    });
  } catch (error) {
    if (String(error.message).includes("UNIQUE"))
      return res
        .status(409)
        .json({ error: "A key already exists for that email" });
    return next(error);
  }

  // The raw key is returned exactly once; only its hash is stored.
  res.json({
    apiKey,
    confirmationLink: `${process.env.WORDSMITH_BASE_URL}/confirm-key?token=${encodeURIComponent(apiKey)}`,
  });
}

export async function confirmKey(req, res, next) {
  try {
    const record = await findByRawKey(
      decodeURIComponent(req.query.token || ""),
    );

    if (!record || record.status !== STATUS.UNCONFIRMED)
      return res.status(404).send("Invalid or already confirmed key.");

    const conn = await db();
    await conn.execute({
      sql: "UPDATE api_keys SET status = ? WHERE id = ?",
      args: [STATUS.ACTIVE, record.id],
    });
    res.redirect("/confirmation-success");
  } catch (error) {
    next(error);
  }
}

export async function checkKeyStatus(req, res, next) {
  try {
    const record = await findByRawKey(req.query.apiKey);
    if (!record) return res.status(404).json({ error: "API key not found" });
    res.json({ status: record.status });
  } catch (error) {
    next(error);
  }
}

export async function revokeKey(req, res, next) {
  if (!isMaster(req)) return res.status(403).json({ error: "Forbidden" });

  try {
    const record = await findByRawKey((req.body || {}).apiKey);
    if (!record) return res.status(404).json({ error: "API key not found" });

    const conn = await db();
    await conn.execute({
      sql: "UPDATE api_keys SET status = ? WHERE id = ?",
      args: [STATUS.REVOKED, record.id],
    });
    res.json({ message: "API key revoked" });
  } catch (error) {
    next(error);
  }
}

/** Revoke every active key untouched for `days`. Returns the count revoked. */
export async function revokeInactiveKeys(days) {
  const conn = await db();
  const result = await conn.execute({
    sql: `UPDATE api_keys SET status = ?
           WHERE status = ?
             AND last_accessed IS NOT NULL
             AND last_accessed < datetime('now', ?)`,
    args: [STATUS.REVOKED, STATUS.ACTIVE, `-${Number(days)} days`],
  });
  return result.rowsAffected;
}
