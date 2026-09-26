import { defineConfig } from "drizzle-kit";

/**
 * Migrations are generated from schema.ts and committed, then applied at
 * startup by db.ts. Generating them (rather than pushing) means a schema
 * change shows up as a reviewable SQL diff.
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/store/schema.ts",
  out: "./src/store/migrations",
});
