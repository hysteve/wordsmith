/**
 * The one database connection in the process.
 *
 * There used to be three stores for a single table: a JSON file
 * (`src/db/keystore.json`), a better-sqlite3 handle on `keystore.db` opened
 * relative to the current working directory, and a knex handle on
 * `./db/keystore.db`. They disagreed about both the schema and the file, so
 * which one you got depended on where you launched the process from.
 *
 * This is the only place a database is opened now, and the path comes from
 * `paths.ts`, so the CLI and the server always reach the same data.
 *
 * The driver is libSQL rather than better-sqlite3 because better-sqlite3 needs
 * a native build node-gyp can no longer produce here, and because the same
 * client speaks to a local file today and to hosted Turso or Postgres later by
 * changing WORDSMITH_DB_URL alone.
 */
import { createClient, type Client } from "@libsql/client";
import path from "node:path";
import { dataDir, ensureDir } from "../paths.ts";
import { applySchema } from "./schema.ts";

/** Local file by default; set WORDSMITH_DB_URL to point at a hosted database. */
export function databaseUrl(): string {
  if (process.env.WORDSMITH_DB_URL) return process.env.WORDSMITH_DB_URL;
  return `file:${path.join(dataDir(), "wordsmith.db")}`;
}

let client: Client | null = null;
let ready: Promise<Client> | null = null;

/**
 * The shared client, with the schema applied exactly once.
 * Always await this: `const conn = await db()`.
 *
 * A plain function rather than a Proxy: libraries that introspect a database
 * handle break when property access is intercepted.
 */
export function db(): Promise<Client> {
  if (!ready) {
    const url = databaseUrl();
    if (url.startsWith("file:")) ensureDir(path.dirname(url.slice(5)));

    client = createClient({
      url,
      authToken: process.env.WORDSMITH_DB_AUTH_TOKEN, // only needed when hosted
    });

    ready = applySchema(client).then(() => client as Client);
  }
  return ready;
}

export async function closeDb(): Promise<void> {
  if (!client) return;
  const closing = client;
  client = null;
  ready = null;
  closing.close();
}
