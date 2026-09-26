/**
 * Is a domain registered?
 *
 * The previous version asked the parsed WHOIS record for
 * `domainName || registrar || status` and answered "available" for anything
 * else. Three things were wrong, and they all failed in the same direction —
 * reporting a registered domain as free:
 *
 *   1. WHOIS field names vary by registry. example.com comes back from IANA as
 *      `{ domain, organisation, created, source }` with no `domainName` at
 *      all, so the most famous registered domain on the internet read as
 *      available.
 *   2. Registries rate-limit, and a throttled reply is boilerplate with no
 *      registration fields — indistinguishable from "nobody owns this".
 *   3. The fallback was `available: true`. For this tool that is the expensive
 *      direction to be wrong in: you act on "available" by trying to buy the
 *      name or building something around it. Not knowing must not look like
 *      yes.
 *
 * It reads the raw WHOIS text rather than a parsed record, because the answer
 * we need ("No match for domain ...") is a line the parser throws away. The
 * result is three-valued: `true` only when the registry said the name is free,
 * `false` on evidence of registration, `null` when the query settled nothing.
 */
// `whois` is CommonJS with named exports only, so it is imported namespaced.
import * as whois from "whois";

/** How registries say "no such name". */
const AVAILABLE_MARKERS = [
  "no match for",
  "not found",
  "no data found",
  "no entries found",
  "domain not found",
  "no object found",
  "available for registration",
  "status: free",
  "status: available",
];

/**
 * Labels that only appear for a name somebody owns. Matched at the start of a
 * line so the words can't be picked up out of a registry's legal boilerplate.
 */
const REGISTRATION_LABELS =
  /^\s*(domain name|domain|registrar|registry domain id|sponsoring registrar|creation date|created|registered on|updated date|registry expiry date|expiry date|expires on|domain status|status|name server|nserver|organisation|organization|registrant)\s*:/im;

/**
 * Decide from raw WHOIS text. Pure, so every interesting case is testable
 * without touching the network.
 *
 * @param {string} raw
 * @returns {{available: boolean|null, reason: string}}
 */
export function interpretWhois(raw) {
  const text = String(raw || "").trim();
  if (!text) return { available: null, reason: "Empty WHOIS response" };

  const lower = text.toLowerCase();

  // Availability wins over field detection: a "no match" reply can still carry
  // boilerplate that mentions these labels.
  const marker = AVAILABLE_MARKERS.find((m) => lower.includes(m));
  if (marker)
    return { available: true, reason: `Registry reported "${marker}"` };

  const label = text.match(REGISTRATION_LABELS);
  if (label) {
    return {
      available: false,
      reason: `Registered (${label[1].toLowerCase()})`,
    };
  }

  // Boilerplate only — a rate-limited or unparseable reply. Answering
  // "available" here is what made the old version dangerous.
  return {
    available: null,
    reason:
      "WHOIS returned neither registration data nor an availability marker",
  };
}

function lookup(domain, timeout) {
  return new Promise((resolve, reject) => {
    // The callback is the only error channel; a throw here would escape it.
    try {
      whois.lookup(domain, { timeout }, (error, data) =>
        error ? reject(error) : resolve(data),
      );
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * @param {string} domain
 * @param {{retries?: number, timeout?: number}} [options]
 * @returns {Promise<{available: boolean|null, reason: string}>}
 */
export async function checkDomainAvailability(domain, options = {}) {
  const { retries = 2, timeout = 10000 } = options;
  if (!domain) return { available: null, reason: "No domain given" };

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return interpretWhois(await lookup(domain, timeout));
    } catch (error) {
      lastError = error;
      const transient =
        ["ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED"].includes(
          error.code,
        ) || /getaddrinfo|timeout|socket/i.test(error.message || "");
      if (!transient) break;
    }
  }

  return {
    available: null,
    reason: `WHOIS lookup failed: ${lastError?.message ?? "unknown error"}`,
  };
}
