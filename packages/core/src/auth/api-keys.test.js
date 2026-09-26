/**
 * API key storage and lifecycle, against a real (temporary) database.
 *
 * These exist because the previous implementation stored bcrypt hashes and
 * then looked keys up by equality, so no key could ever authenticate. A test
 * that issues a key and finds it again would have caught that on day one.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Point the store at a scratch directory before anything opens it.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wordsmith-test-"));
process.env.WORDSMITH_DB_URL = `file:${path.join(tmp, "test.db")}`;
process.env.WORDSMITH_MASTER_KEY = "test-master-key";

const { db, closeDb } = await import("../store/db.ts");
const { hashKey, STATUS } = await import("./api-keys.js");

test.after(async () => {
  await closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("the schema is applied on first open", async () => {
  const conn = await db();
  const { rows } = await conn.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='api_keys'",
  );
  assert.equal(rows.length, 1);
});

test("hashKey is deterministic, which is what lookup depends on", () => {
  const a = hashKey("abc123");
  assert.equal(a, hashKey("abc123"));
  assert.notEqual(a, hashKey("abc124"));
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("a stored key can be found again by its raw value", async () => {
  const conn = await db();
  const raw = "deadbeef".repeat(8);

  await conn.execute({
    sql: "INSERT INTO api_keys (email, key_hash, status) VALUES (?, ?, ?)",
    args: ["found@example.com", hashKey(raw), STATUS.ACTIVE],
  });

  const { rows } = await conn.execute({
    sql: "SELECT email, status FROM api_keys WHERE key_hash = ?",
    args: [hashKey(raw)],
  });
  assert.equal(rows.length, 1, "the key is findable by its raw value");
  assert.equal(rows[0].email, "found@example.com");
});

test("one email cannot hold two keys", async () => {
  const conn = await db();
  await conn.execute({
    sql: "INSERT INTO api_keys (email, key_hash, status) VALUES (?, ?, ?)",
    args: ["dupe@example.com", hashKey("first"), STATUS.UNCONFIRMED],
  });
  await assert.rejects(
    conn.execute({
      sql: "INSERT INTO api_keys (email, key_hash, status) VALUES (?, ?, ?)",
      args: ["dupe@example.com", hashKey("second"), STATUS.UNCONFIRMED],
    }),
    /UNIQUE/,
  );
});

test("new keys default to unconfirmed with a free quota", async () => {
  const conn = await db();
  await conn.execute({
    sql: "INSERT INTO api_keys (email, key_hash) VALUES (?, ?)",
    args: ["defaults@example.com", hashKey("defaults")],
  });
  const { rows } = await conn.execute({
    sql: "SELECT status, role, request_count, request_limit, period_start FROM api_keys WHERE email = ?",
    args: ["defaults@example.com"],
  });
  assert.equal(rows[0].status, STATUS.UNCONFIRMED);
  assert.equal(rows[0].role, "free");
  assert.equal(rows[0].request_count, 0);
  assert.equal(rows[0].request_limit, 1000);
  assert.ok(rows[0].period_start, "a quota period starts immediately");
});
