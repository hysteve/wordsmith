#!/usr/bin/env node
/** Revoke every active API key that hasn't been used in N days. */
import { revokeInactiveKeys } from "../api/auth/auth-module.js";
import { closeDb } from "../store/db.js";

const days = Number.parseInt(process.argv[2], 10);

if (!Number.isFinite(days) || days <= 0) {
  console.error("Usage: revoke-inactive-keys <days>");
  process.exit(1);
}

const revoked = await revokeInactiveKeys(days);
console.log(`Revoked ${revoked} key(s) inactive for ${days}+ days.`);
await closeDb();
