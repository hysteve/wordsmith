/**
 * The one database connection in the process.
 *
 * There used to be three stores for a single table: a JSON file
 * (`src/db/keystore.json`), a better-sqlite3 handle on `keystore.db` opened
 * relative to the current working directory, and a knex handle on
 * `./db/keystore.db`. They disagreed about both the schema and the file, so
 * which one you got depended on where you launched the process from.
 *
 * This is the only place a database is opened now, and the path is absolute
 * so the CLI and the server always reach the same data.
 *
 * The driver is libSQL rather than better-sqlite3 because better-sqlite3 needs
 * a native build that node-gyp can no longer produce here, and because the
 * same client speaks to a local file today and to hosted Turso or Postgres
 * later by changing WORDSMITH_DB_URL alone.
 */
import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { applySchema } from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(__dirname, "../../data");

/** Local file by default; set WORDSMITH_DB_URL to point at a hosted database. */
export function databaseUrl() {
  if (process.env.WORDSMITH_DB_URL) return process.env.WORDSMITH_DB_URL;
  const dir = process.env.WORDSMITH_DATA_DIR || DEFAULT_DIR;
  return `file:${path.join(dir, "wordsmith.db")}`;
}

let client = null;
let ready = null;

/**
 * The shared client, with the schema applied exactly once.
 * Always await this: `const conn = await db()`.
 */
export function db() {
  if (!ready) {
    const url = databaseUrl();

    if (url.startsWith("file:")) {
      fs.mkdirSync(path.dirname(url.slice("file:".length)), {
        recursive: true,
      });
    }

    client = createClient({
      url,
      authToken: process.env.WORDSMITH_DB_AUTH_TOKEN, // needed only when hosted
    });

    ready = applySchema(client).then(() => client);
  }
  return ready;
}

export async function closeDb() {
  if (!client) return;
  const closing = client;
  client = null;
  ready = null;
  await closing.close();
}
