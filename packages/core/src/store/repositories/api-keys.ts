/**
 * API key storage.
 *
 * The lookup hash is deterministic on purpose. The previous implementation
 * stored a bcrypt hash and then searched for it by equality, which is salted
 * and therefore never matched — no key could authenticate at all. A 256-bit
 * random key needs no stretching, so SHA-256 is both correct and searchable.
 */
import crypto from "node:crypto";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "../db.ts";
import { apiKeys } from "../schema.ts";
import { DuplicateError, isUniqueViolation, violatedField } from "../errors.ts";

export type ApiKey = typeof apiKeys.$inferSelect;

export const STATUS = Object.freeze({
  REVOKED: -1,
  UNCONFIRMED: 0,
  ACTIVE: 1,
});

export function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(String(rawKey)).digest("hex");
}

export async function findByRawKey(
  rawKey: string,
): Promise<ApiKey | undefined> {
  if (!rawKey) return undefined;
  const database = await db();
  const [row] = await database
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hashKey(rawKey)))
    .limit(1);
  return row;
}

/**
 * Issue a key. The raw value is returned once and never stored.
 * Throws DuplicateError when the email already has one.
 */
export async function createApiKey(
  email: string,
  role = "free",
): Promise<{ apiKey: string; record: ApiKey }> {
  const apiKey = crypto.randomBytes(32).toString("hex");
  const database = await db();

  try {
    const [record] = await database
      .insert(apiKeys)
      .values({
        email,
        keyHash: hashKey(apiKey),
        status: STATUS.UNCONFIRMED,
        role,
      })
      .returning();
    return { apiKey, record };
  } catch (error) {
    if (isUniqueViolation(error))
      throw new DuplicateError(violatedField(error), error);
    throw error;
  }
}

export async function setStatus(id: number, status: number): Promise<void> {
  const database = await db();
  await database.update(apiKeys).set({ status }).where(eq(apiKeys.id, id));
}

export async function touchLastAccessed(id: number): Promise<void> {
  const database = await db();
  await database
    .update(apiKeys)
    .set({ lastAccessed: sql`datetime('now')` })
    .where(eq(apiKeys.id, id));
}

export async function consumeCredit(
  id: number,
  count: number,
  periodStart: string,
): Promise<void> {
  const database = await db();
  await database
    .update(apiKeys)
    .set({ requestCount: count, periodStart })
    .where(eq(apiKeys.id, id));
}

/** Revoke every active key untouched for `days`. Returns the count revoked. */
export async function revokeInactiveKeys(days: number): Promise<number> {
  const database = await db();
  const revoked = await database
    .update(apiKeys)
    .set({ status: STATUS.REVOKED })
    .where(
      and(
        eq(apiKeys.status, STATUS.ACTIVE),
        isNotNull(apiKeys.lastAccessed),
        lt(
          apiKeys.lastAccessed,
          sql`datetime('now', ${`-${Number(days)} days`})`,
        ),
      ),
    )
    .returning({ id: apiKeys.id });
  return revoked.length;
}
