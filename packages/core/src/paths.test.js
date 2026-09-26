/**
 * Paths must not depend on the working directory. They used to: the keyword
 * clouds lived under `process.cwd()`, so running the CLI from a subdirectory
 * silently showed you an empty set.
 */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { workspaceRoot, dataDir, cloudsDir, outputDir } from "./paths.ts";

test("the workspace root is found by its manifest, not by the cwd", () => {
  const original = process.cwd();
  try {
    process.chdir(path.dirname(original));
    // Re-reading the exported constant is enough: it was resolved at import
    // time from this file's own location.
    assert.ok(workspaceRoot.endsWith("wordsmith"));
    assert.equal(dataDir(), path.join(workspaceRoot, "data"));
  } finally {
    process.chdir(original);
  }
});

test("clouds live under the data directory", () => {
  assert.equal(cloudsDir(), path.join(dataDir(), "clouds"));
});

test("the environment can relocate the data directory, clouds included", () => {
  const previous = process.env.WORDSMITH_DATA_DIR;
  try {
    process.env.WORDSMITH_DATA_DIR = "/tmp/elsewhere";
    assert.equal(dataDir(), "/tmp/elsewhere");
    // The old code put clouds directly in WORDSMITH_DATA_DIR when it was set,
    // but in a `clouds` subdirectory otherwise. The two now agree.
    assert.equal(cloudsDir(), path.join("/tmp/elsewhere", "clouds"));
  } finally {
    if (previous === undefined) delete process.env.WORDSMITH_DATA_DIR;
    else process.env.WORDSMITH_DATA_DIR = previous;
  }
});

test("output has its own switch, separate from data", () => {
  const previous = process.env.WORDSMITH_OUTPUT_DIR;
  try {
    delete process.env.WORDSMITH_OUTPUT_DIR;
    assert.equal(outputDir(), path.join(workspaceRoot, "output"));
    process.env.WORDSMITH_OUTPUT_DIR = "/tmp/out";
    assert.equal(outputDir(), "/tmp/out");
  } finally {
    if (previous === undefined) delete process.env.WORDSMITH_OUTPUT_DIR;
    else process.env.WORDSMITH_OUTPUT_DIR = previous;
  }
});
