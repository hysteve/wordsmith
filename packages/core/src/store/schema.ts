/**
 * The schema, applied on open. Every statement must be idempotent, so this
 * doubles as the migration path until there is a reason for a real one.
 */
import type { Client } from "@libsql/client";

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS api_keys (
     id            INTEGER PRIMARY KEY AUTOINCREMENT,
     email         TEXT    NOT NULL UNIQUE,
     -- SHA-256 of the raw key. Deterministic on purpose: authentication has
     -- to find a key by its value, which a salted hash cannot do. The key is
     -- 256 bits of randomness, so it needs no stretching.
     key_hash      TEXT    NOT NULL UNIQUE,
     -- -1 revoked, 0 awaiting confirmation, 1 active
     status        INTEGER NOT NULL DEFAULT 0,
     role          TEXT    NOT NULL DEFAULT 'free',
     request_count INTEGER NOT NULL DEFAULT 0,
     request_limit INTEGER NOT NULL DEFAULT 1000,
     period_start  TEXT    NOT NULL DEFAULT (datetime('now')),
     created       TEXT    NOT NULL DEFAULT (datetime('now')),
     last_accessed TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS api_keys_key_hash ON api_keys (key_hash)`,
];

export async function applySchema(client: Client): Promise<void> {
  for (const sql of STATEMENTS) await client.execute(sql);
}
