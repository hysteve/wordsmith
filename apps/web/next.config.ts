import type { NextConfig } from "next";

const config: NextConfig = {
  // core ships TypeScript sources rather than a build, so the bundler has to
  // compile them. Node runs them directly by stripping types; Next does not.
  transpilePackages: ["@wordsmith/core"],

  // core reaches the browser, the database and the filesystem. None of that
  // belongs in a client bundle, and several of its dependencies cannot be
  // bundled at all.
  serverExternalPackages: [
    "@libsql/client",
    "browserless",
    "puppeteer",
    "whois",
    "geoip-lite",
    "natural",
  ],
};

export default config;
