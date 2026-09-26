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
 * client speaks to a local file today and to hosted Turso later by changing
 * WORDSMITH_DB_URL alone.
 */
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dataDir, ensureDir } from "../paths.ts";
import * as schema from "./schema.ts";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Local file by default; set WORDSMITH_DB_URL to point at a hosted database. */
export function databaseUrl(): string {
  if (process.env.WORDSMITH_DB_URL) return process.env.WORDSMITH_DB_URL;
  return `file:${path.join(dataDir(), "wordsmith.db")}`;
}

export type Database = LibSQLDatabase<typeof schema>;

let client: Client | null = null;
let ready: Promise<Database> | null = null;

/**
 * The shared, migrated handle. Always await it: `const database = await db()`.
 *
 * A plain function rather than a Proxy: libraries that introspect a database
 * handle break when property access is intercepted.
 */
export function db(): Promise<Database> {
  if (!ready) {
    const url = databaseUrl();
    if (url.startsWith("file:")) ensureDir(path.dirname(url.slice(5)));

    client = createClient({
      url,
      authToken: process.env.WORDSMITH_DB_AUTH_TOKEN, // only needed when hosted
    });

    const database = drizzle(client, { schema });

    // Migrations are generated from schema.ts and committed; applying them on
    // open means a CLI and the server can never disagree about the shape.
    ready = migrate(database, {
      migrationsFolder: path.join(here, "migrations"),
    }).then(() => database);
  }
  return ready;
}

/** The raw libSQL client, for the rare query Drizzle should not own. */
export async function rawClient(): Promise<Client> {
  await db();
  return client as Client;
}

export async function closeDb(): Promise<void> {
  if (!client) return;
  const closing = client;
  client = null;
  ready = null;
  closing.close();
}

export { schema };
