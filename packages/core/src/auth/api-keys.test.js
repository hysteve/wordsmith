/**
 * API key storage and lifecycle, against a real (temporary) database.
 *
 * These exist because the previous implementation stored bcrypt hashes and
 * then looked keys up by equality, so no key could ever authenticate. A test
 * that issued a key and found it again would have caught that on day one.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wordsmith-keys-"));
process.env.WORDSMITH_DB_URL = `file:${path.join(tmp, "keys.db")}`;

const { closeDb } = await import("../store/db.ts");
const keys = await import("../store/repositories/api-keys.ts");

test.after(async () => {
  await closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("hashKey is deterministic, which is what lookup depends on", () => {
  const a = keys.hashKey("abc123");
  assert.equal(a, keys.hashKey("abc123"));
  assert.notEqual(a, keys.hashKey("abc124"));
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("an issued key can be found again by its raw value", async () => {
  const { apiKey, record } = await keys.createApiKey("found@example.com");

  // The whole point: the raw value the caller holds finds the stored row.
  const looked = await keys.findByRawKey(apiKey);
  assert.ok(looked, "a freshly issued key must be findable");
  assert.equal(looked.id, record.id);
  assert.equal(looked.email, "found@example.com");
});

test("the raw key is never stored, only its hash", async () => {
  const { apiKey, record } = await keys.createApiKey("secret@example.com");
  assert.notEqual(record.keyHash, apiKey);
  assert.equal(record.keyHash, keys.hashKey(apiKey));
});

test("an unknown or empty key finds nothing", async () => {
  assert.equal(await keys.findByRawKey("not-a-real-key"), undefined);
  assert.equal(await keys.findByRawKey(""), undefined);
});

test("new keys start unconfirmed with a free quota", async () => {
  const { record } = await keys.createApiKey("defaults@example.com");
  assert.equal(record.status, keys.STATUS.UNCONFIRMED);
  assert.equal(record.role, "free");
  assert.equal(record.requestCount, 0);
  assert.equal(record.requestLimit, 1000);
  assert.ok(record.periodStart, "a quota period starts immediately");
});

test("one email cannot hold two keys, and says so in a form callers can act on", async () => {
  const { DuplicateError } = await import("../store/errors.ts");
  await keys.createApiKey("dupe@example.com");

  // Drizzle wraps driver errors, so the "UNIQUE constraint failed" text is on
  // error.cause. Callers get a typed error rather than sniffing a message.
  await assert.rejects(keys.createApiKey("dupe@example.com"), (error) => {
    assert.ok(error instanceof DuplicateError);
    assert.equal(error.field, "email");
    return true;
  });
});

test("confirming and revoking move the status", async () => {
  const { apiKey, record } = await keys.createApiKey("lifecycle@example.com");

  await keys.setStatus(record.id, keys.STATUS.ACTIVE);
  assert.equal((await keys.findByRawKey(apiKey)).status, keys.STATUS.ACTIVE);

  await keys.setStatus(record.id, keys.STATUS.REVOKED);
  assert.equal((await keys.findByRawKey(apiKey)).status, keys.STATUS.REVOKED);
});

test("revokeInactiveKeys only touches active keys that have gone quiet", async () => {
  const { apiKey: fresh, record: freshRecord } =
    await keys.createApiKey("fresh@example.com");
  await keys.setStatus(freshRecord.id, keys.STATUS.ACTIVE);
  await keys.touchLastAccessed(freshRecord.id);

  // A key that has never been used has no lastAccessed and is left alone.
  const { apiKey: unused, record: unusedRecord } =
    await keys.createApiKey("unused@example.com");
  await keys.setStatus(unusedRecord.id, keys.STATUS.ACTIVE);

  const revoked = await keys.revokeInactiveKeys(30);
  assert.equal(revoked, 0, "nothing here is 30 days old");
  assert.equal((await keys.findByRawKey(fresh)).status, keys.STATUS.ACTIVE);
  assert.equal((await keys.findByRawKey(unused)).status, keys.STATUS.ACTIVE);
});

test("consuming a credit records the count and the period", async () => {
  const { apiKey, record } = await keys.createApiKey("quota@example.com");
  await keys.consumeCredit(record.id, 5, "2026-09-01 00:00:00");

  const after = await keys.findByRawKey(apiKey);
  assert.equal(after.requestCount, 5);
  assert.equal(after.periodStart, "2026-09-01 00:00:00");
});
