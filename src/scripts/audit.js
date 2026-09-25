#!/usr/bin/env node
import { Command } from "commander";
import path from "path";
import fs from "fs/promises";
import chalk from "chalk";

import { runPerformanceAudit } from "../audits/performance.js";
import { runSEOAudit } from "../audits/seo.js";
import { runAccessibilityAudit } from "../audits/accessibility.js";
import { runUXAudit } from "../audits/ux.js";
import { runContentAudit } from "../audits/content.js";
import { runSecurityAudit } from "../audits/security.js";
import { runAnalyticsAudit } from "../audits/analytics.js";
import { runBusinessAudit } from "../audits/business.js";
import { runReputationAudit } from "../audits/reputation.js";

const auditMap = {
  performance: runPerformanceAudit,
  seo: runSEOAudit,
  accessibility: runAccessibilityAudit,
  ux: runUXAudit,
  content: runContentAudit,
  security: runSecurityAudit,
  analytics: runAnalyticsAudit,
  business: runBusinessAudit,
  reputation: runReputationAudit,
};

const allAuditTypes = Object.keys(auditMap);

function normalizeUrl(url) {
  if (!/^https?:\/\//i.test(url)) {
    return `https://www.${url.replace(/^www\./, "")}`;
  }
  if (/^http:\/\//i.test(url)) {
    return url.replace(/^http:\/\//i, "https://");
  }
  return url;
}

const program = new Command();
program
  .name("audit")
  .description("Run a suite of audits on a website")
  .argument("<url>", "The URL to audit")
  .option(
    "-a, --audits <types>",
    `Comma-separated list of audits to run (${allAuditTypes.join(", ")})`,
    "all",
  )
  .option("--skipLM", "Skip language model analysis steps")
  .option(
    "--googleReviews",
    "Fetch Google ratings/reviews via the Places API (PAID: Place Details bills at $25/1000 requests; needs GOOGLE_MAPS_API_KEY)",
  )
  .option(
    "--placeId <id>",
    "Use a known Google place ID instead of resolving one (skips the free lookup step)",
  )
  .option("-o, --output <file>", "Output JSON file path")
  .option(
    "--outputDir <dir>",
    "Directory for screenshots and results",
    "audit-results",
  )
  .action(async (url, options) => {
    const auditsToRun =
      options.audits === "all"
        ? allAuditTypes
        : options.audits
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean);
    const results = {
      url,
      timestamp: new Date().toISOString(),
      audits: {},
    };
    const outputDir = path.resolve(options.outputDir);
    await fs.mkdir(outputDir, { recursive: true });
    const normalizedUrl = normalizeUrl(url);
    for (const auditType of auditsToRun) {
      if (!auditMap[auditType]) {
        console.log(chalk.yellow(`Unknown audit type: ${auditType}`));
        continue;
      }
      console.log(chalk.cyan(`\nRunning ${auditType} audit...`));
      try {
        results.audits[auditType] = await auditMap[auditType](normalizedUrl, {
          outputDir,
          skipLM: options.skipLM,
          googleReviews: options.googleReviews,
          placeId: options.placeId,
        });
        if (results.audits[auditType]?.error) {
          console.log(
            chalk.red(
              `✖ ${auditType} error: ${results.audits[auditType].error}`,
            ),
          );
        } else {
          console.log(chalk.green(`✔ ${auditType} complete`));
        }
      } catch (e) {
        results.audits[auditType] = { error: e.message, stack: e.stack };
        console.log(chalk.red(`✖ ${auditType} failed: ${e.message}`));
      }
    }
    // Write output JSON
    const outFile =
      options.output ||
      path.join(outputDir, `audit-${new URL(normalizedUrl).hostname}.json`);
    await fs.writeFile(outFile, JSON.stringify(results, null, 2));
    console.log(chalk.bold(`\nAudit complete! Results saved to ${outFile}`));
    // Pretty-print summary
    for (const [type, result] of Object.entries(results.audits)) {
      if (result && result.score !== undefined) {
        console.log(chalk.magenta(`${type}:`), chalk.bold(result.score));
      } else if (result && result.lmAnalysis) {
        console.log(chalk.magenta(`${type}:`), chalk.gray("(see LM analysis)"));
      } else if (result && result.error) {
        console.log(chalk.magenta(`${type}:`), chalk.red(result.error));
      } else {
        console.log(chalk.magenta(`${type}:`), chalk.gray("done"));
      }
    }
    process.exit(0);
  });

program.parse(process.argv);
