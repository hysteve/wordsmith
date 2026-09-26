/**
 * Where things live on disk.
 *
 * Paths used to be worked out per-module, some relative to the file and some
 * to `process.cwd()`. That meant the database and the keyword clouds moved
 * depending on which directory you launched from, and moving a file between
 * packages silently relocated its data. Everything that touches the filesystem
 * resolves through here instead.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Walk up until the workspace manifest turns up; that directory is the root. */
function findWorkspaceRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));

  while (true) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      // Installed outside the workspace; fall back to the working directory.
      return process.cwd();
    }
    dir = parent;
  }
}

export const workspaceRoot: string = findWorkspaceRoot();

/** Everything the tools generate, in one place, overridable for tests. */
export function dataDir(): string {
  return process.env.WORDSMITH_DATA_DIR || path.join(workspaceRoot, "data");
}

export function cloudsDir(): string {
  return path.join(dataDir(), "clouds");
}

/** Screenshots, audit JSON, and the domain-availability caches. */
export function outputDir(): string {
  return process.env.WORDSMITH_OUTPUT_DIR || path.join(workspaceRoot, "output");
}

export function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
