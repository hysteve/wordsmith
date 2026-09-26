/**
 * The one browser in the process.
 *
 * Every scraping module used to call `createBrowser()` at module scope, and
 * browserless spawns the Chrome process on that call rather than on first use
 * (`browserless/src/index.js`: `let browserProcessPromise = spawn()`). So
 * *importing* a module spawned a browser, and importing several spawned
 * several — `cloud create`, which never scrapes anything, held three of them
 * open and then leaked them on exit.
 *
 * This module fixes that shape: one shared instance, spawned on first real
 * use, closed on demand. Import `browser` and use it exactly like the
 * browserless instance it replaces; nothing spawns until you touch it.
 */
import createBrowser from "browserless";
import { onExit } from "signal-exit";

const DEFAULT_TIMEOUT = Number(process.env.WORDSMITH_BROWSER_TIMEOUT || 120000);

let instance = null;

/** Spawn on first call, reuse forever after. */
function acquire() {
  if (!instance) {
    instance = createBrowser({ timeout: DEFAULT_TIMEOUT });
    // Last resort: if the process dies with a browser open, don't orphan it.
    onExit(() => {
      if (instance) instance.close();
    });
  }
  return instance;
}

/**
 * A stand-in for the browserless instance that spawns Chrome on first
 * property access. Call sites read `browser.createContext()` as before.
 */
export const browser = new Proxy(
  {},
  {
    get(_target, prop) {
      const value = acquire()[prop];
      return typeof value === "function" ? value.bind(instance) : value;
    },
  },
);

/** True once Chrome has actually been spawned. */
export function browserStarted() {
  return instance !== null;
}

/**
 * Shut the browser down and let the event loop drain.
 *
 * A long-lived server never needs this; a CLI always does, because an open
 * browser keeps the process alive indefinitely. Safe to call when no browser
 * was ever started.
 */
export async function closeBrowser() {
  if (!instance) return;
  const closing = instance;
  instance = null;
  await closing.close().catch(() => {});
}

/**
 * Run `fn` against a fresh browser context and always tear it down.
 * Preferred over `browser.createContext()` at new call sites.
 */
export async function withContext(fn, contextOptions = {}) {
  const context = await acquire().createContext(contextOptions);
  try {
    return await fn(context);
  } finally {
    await context.destroyContext().catch(() => {});
  }
}
