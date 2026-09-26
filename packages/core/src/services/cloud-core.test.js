/**
 * The guard on the pure/IO seam.
 *
 * cloud-core.js exists so a consumer can reason about a cloud document — roles,
 * the containment lattice, the report — without importing the scrapers, and
 * through them browserless, puppeteer, Lighthouse and geoip-lite. That only
 * holds while the file has no imports, and nothing about editing it makes that
 * obvious. This test makes it obvious.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "cloud-core.js"), "utf8");

test("cloud-core.js imports nothing at all", () => {
  const imports = source.match(/^\s*import\s.+$/gm) || [];
  assert.deepEqual(
    imports,
    [],
    "adding an import here puts Chrome back in the graph for every consumer",
  );
});

test("cloud-core.js does not require() or dynamically import either", () => {
  assert.doesNotMatch(source, /\brequire\s*\(/, "no CommonJS require");
  assert.doesNotMatch(source, /\bimport\s*\(/, "no dynamic import");
});

test("importing the pure half loads no browser machinery", async () => {
  await import("./cloud-core.js");
  const heavy = process.moduleLoadList.filter((m) =>
    /puppeteer|browserless|lighthouse|geoip|whois/.test(m),
  );
  assert.deepEqual(heavy, [], `pure import pulled in: ${heavy.join(", ")}`);
});

test("the pure surface Stoker depends on is actually exported", async () => {
  const core = await import("./cloud-core.js");
  for (const name of [
    "STATUS",
    "ROLE",
    "normalizePhrase",
    "tokenize",
    "deriveRole",
    "isQuestion",
    "roleOf",
    "contains",
    "ancestorsOf",
    "descendantsOf",
    "rollUp",
    "findTerm",
    "getTerms",
    "getKeywords",
    "getQueries",
    "buildReport",
  ]) {
    assert.ok(core[name], `cloud-core.js must export ${name}`);
  }
});

test("the I/O module re-exports the pure surface, so callers need not choose", async () => {
  const [core, io] = await Promise.all([
    import("./cloud-core.js"),
    import("./cloud.js"),
  ]);
  for (const name of Object.keys(core)) {
    assert.ok(io[name], `cloud.js must keep re-exporting ${name}`);
  }
});
