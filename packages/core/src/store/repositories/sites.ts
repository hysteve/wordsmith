/**
 * Sites are keyed by bare hostname so that every measurement about
 * "ultrabrightlightz.com" joins up regardless of whether the caller passed a
 * scheme, a www, a path, or a trailing slash.
 */
import { eq } from "drizzle-orm";
import { db } from "../db.ts";
import { sites } from "../schema.ts";

/** "https://www.Example.com/page?x=1" -> "example.com" */
export function normalizeHost(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("A host or URL is required");
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return raw.toLowerCase().replace(/^www\./, "");
  }
}

export type Site = typeof sites.$inferSelect;

/** Find or create the site for a host or URL. */
export async function siteFor(
  hostOrUrl: string,
  label?: string,
): Promise<Site> {
  const host = normalizeHost(hostOrUrl);
  const database = await db();

  const existing = await database
    .select()
    .from(sites)
    .where(eq(sites.host, host))
    .limit(1);
  if (existing[0]) return existing[0];

  const [created] = await database
    .insert(sites)
    .values({ host, label: label ?? null })
    .onConflictDoNothing()
    .returning();

  // A concurrent insert won the race; read it back.
  if (created) return created;
  const [row] = await database
    .select()
    .from(sites)
    .where(eq(sites.host, host))
    .limit(1);
  return row;
}

export async function listSites(): Promise<Site[]> {
  const database = await db();
  return database.select().from(sites).orderBy(sites.host);
}
