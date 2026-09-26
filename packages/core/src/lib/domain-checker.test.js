/**
 * Domain availability, from real WHOIS response shapes.
 *
 * The old checker asked a parsed record for `domainName || registrar ||
 * status` and answered "available" for anything else, which reported
 * example.com — whose IANA record has no `domainName` field — as free. Every
 * failure mode pointed the same way: registered names looking available. These
 * fixtures are trimmed from actual responses.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { interpretWhois } from "./domain-checker.js";

/** IANA's thin record: labelled `domain`, not `domain name`. */
const IANA_THIN = `
domain:       EXAMPLE.COM
organisation: Internet Assigned Numbers Authority
created:      1992-01-01
source:       IANA
`;

/** A normal gTLD record. */
const GTLD = `
Domain Name: WIKIPEDIA.ORG
Registry Domain ID: 1291379_DOMAIN_ORG-VRSN
Registrar: MarkMonitor, Inc.
Creation Date: 2001-01-13T00:12:47Z
Domain Status: clientDeleteProhibited
Name Server: NS0.WIKIMEDIA.ORG
`;

/** Verisign's answer for a name nobody owns. */
const NO_MATCH = `
No match for domain "QQZZ-FREE-NAME-88213.COM".
>>> Last update of whois database: 2026-09-26T14:34:35Z <<<

NOTICE: The expiration date displayed in this record is the date the
registrar's sponsorship of the domain name registration in the registry.
`;

/** What a rate-limited query looks like: boilerplate and nothing else. */
const THROTTLED = `
>>> Last update of whois database: 2026-09-26T14:33:35Z <<<

NOTICE: The expiration date displayed in this record is the date the
TERMS OF USE: You are not authorized to access or query our Whois database.
`;

test("a thin IANA record counts as registered", () => {
  const result = interpretWhois(IANA_THIN);
  assert.equal(result.available, false, "example.com is not available");
});

test("a normal gTLD record counts as registered", () => {
  assert.equal(interpretWhois(GTLD).available, false);
});

test("'No match for' means genuinely available", () => {
  const result = interpretWhois(NO_MATCH);
  assert.equal(result.available, true);
  assert.match(result.reason, /no match for/);
});

test("a 'no match' reply is not confused by its own boilerplate", () => {
  // NO_MATCH mentions "registrar's sponsorship" and "registration"; the
  // availability marker has to win over loose label matching.
  assert.equal(interpretWhois(NO_MATCH).available, true);
});

test("a throttled reply is unknown, never available", () => {
  const result = interpretWhois(THROTTLED);
  assert.equal(
    result.available,
    null,
    "not knowing must not look like yes — someone acts on 'available'",
  );
  assert.match(result.reason, /neither registration data nor/);
});

test("an empty or missing response is unknown", () => {
  assert.equal(interpretWhois("").available, null);
  assert.equal(interpretWhois(null).available, null);
  assert.equal(interpretWhois(undefined).available, null);
});

test("labels are matched at the start of a line, not inside prose", () => {
  const prose = `
    This text mentions a registrar: and a domain name: in passing but only
    inside a sentence, which is what registry legal boilerplate looks like.
  `;
  // Indented label-like text still counts; what must not count is a match
  // buried mid-sentence.
  const midSentence = "Please contact your registrar about this domain name";
  assert.equal(interpretWhois(midSentence).available, null);
  assert.ok(
    interpretWhois(prose).available !== true,
    "never guesses available",
  );
});

test("other registries' availability wording is recognised", () => {
  for (const text of [
    "Status: free",
    "Domain not found.",
    "NOT FOUND",
    "No Data Found",
    "This domain name is available for registration",
  ]) {
    assert.equal(interpretWhois(text).available, true, `should parse: ${text}`);
  }
});
