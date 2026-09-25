/**
 * Shared browserless navigation options for the audit modules.
 *
 * The audits previously passed nothing, which left the settings up to whatever
 * browserless defaulted to. Two of those defaults matter:
 *
 * - `adblock` must be off for the analytics audit, or the tracker scripts we
 *   are trying to inventory get blocked before they run.
 * - `waitUntil: "networkidle2"` matters for anything reading runtime state
 *   (window.dataLayer, injected consent banners), since tags attach late.
 */

const BASE = {
  device: "macbook pro 13",
  waitUntil: "networkidle2",
  adblock: false,
};

export function gotoOptions(overrides = {}) {
  return { ...BASE, ...overrides };
}
