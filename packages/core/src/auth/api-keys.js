/**
 * Express middleware for API key auth: check the key on every request, meter
 * usage, and gate role-restricted features.
 *
 * Storage lives in the store's api-keys repository; this file is the HTTP
 * policy over it. Three things were wrong with the original and are recorded
 * so they don't come back:
 *
 *   1. It referenced a `keystore` object that no longer existed anywhere in
 *      the file, so the module failed to link and took the server down at
 *      startup — `npm start` could not boot at all.
 *   2. Keys were stored as bcrypt hashes but looked up by equality against
 *      the raw key. bcrypt is salted, so no key could ever authenticate.
 *   3. Redis was connected with a top-level await, making it a hard boot
 *      dependency purely to cache reads from a local database that are
 *      already faster than the network round trip.
 */
import "../env.ts";
import {
  STATUS,
  hashKey,
  findByRawKey,
  createApiKey,
  setStatus,
  touchLastAccessed,
  consumeCredit,
  revokeInactiveKeys,
} from "../store/repositories/api-keys.ts";
import { DuplicateError } from "../store/errors.ts";
import { sqliteTime, parseSqliteTime } from "../store/time.ts";
import { differenceInMonths } from "date-fns";

export { STATUS, hashKey, revokeInactiveKeys };

const CREDITS_PER_MONTH = 1000;
const PREMIUM_MAX_MONTHS = 3; // premium may bank up to three months of credit

function isMaster(req) {
  const masterKey = process.env.WORDSMITH_MASTER_KEY;
  return Boolean(masterKey) && req.headers["x-master-key"] === masterKey;
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

    await touchLastAccessed(record.id);
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

    // periodStart is stored in SQLite's format, which Date() reads as local time.
    const months = differenceInMonths(
      new Date(),
      parseSqliteTime(record.periodStart),
    );
    const isPremium = record.role === "premium";

    let count = record.requestCount;
    let periodStart = record.periodStart;

    if (months >= 1) {
      // A new period started. Free keys reset; premium keys carry the balance
      // forward against a larger allowance.
      count = isPremium ? Math.max(0, count - CREDITS_PER_MONTH * months) : 0;
      periodStart = sqliteTime();
    }

    const allowance = isPremium
      ? Math.min(
          (months + 1) * CREDITS_PER_MONTH,
          PREMIUM_MAX_MONTHS * CREDITS_PER_MONTH,
        )
      : record.requestLimit || CREDITS_PER_MONTH;

    if (count >= allowance)
      return res.status(429).json({ error: "Request credit quota exceeded" });

    await consumeCredit(record.id, count + 1, periodStart);
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

  try {
    const { apiKey } = await createApiKey(email);
    // The raw key is returned exactly once; only its hash is stored.
    res.json({
      apiKey,
      confirmationLink: `${process.env.WORDSMITH_BASE_URL}/confirm-key?token=${encodeURIComponent(apiKey)}`,
    });
  } catch (error) {
    if (error instanceof DuplicateError)
      return res
        .status(409)
        .json({ error: "A key already exists for that email" });
    next(error);
  }
}

export async function confirmKey(req, res, next) {
  try {
    const record = await findByRawKey(
      decodeURIComponent(req.query.token || ""),
    );
    if (!record || record.status !== STATUS.UNCONFIRMED)
      return res.status(404).send("Invalid or already confirmed key.");

    await setStatus(record.id, STATUS.ACTIVE);
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

    await setStatus(record.id, STATUS.REVOKED);
    res.json({ message: "API key revoked" });
  } catch (error) {
    next(error);
  }
}
