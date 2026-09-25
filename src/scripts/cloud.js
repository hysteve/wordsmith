#!/usr/bin/env node
/**
 * Keyword Cloud CLI — see KEYWORD_CLOUD.md.
 *
 * Research tools propose candidates; you promote the good ones into the core
 * set; only core terms get ranking- and coverage-checked.
 */
import { Command } from "commander";
import chalk from "chalk";
import {
  STATUS,
  createCloud,
  loadCloud,
  saveCloud,
  listClouds,
  getTerms,
  addTerm,
  promoteTerm,
  rejectTerm,
  proposeFromCompletions,
  proposeFromPage,
  proposeFromCompetitors,
  proposeFromRelated,
  checkRankings,
  checkCoverage,
  buildReport,
} from "../lib/queries/query-cloud.js";

const program = new Command();
program
  .name("cloud")
  .description("Track a keyword cloud: propose, curate, and measure keywords");

function reportProposal(label, res) {
  console.log(
    chalk.gray(`${label}:`),
    chalk.green(`${res.added} new`),
    chalk.gray("|"),
    `${res.known} already known`,
    chalk.gray("|"),
    `${res.rejected} previously rejected`,
    res.skipped ? chalk.yellow(`| ${res.skipped} skipped`) : "",
  );
}

/** Load, run, save — every mutating command follows this shape. */
async function withCloud(name, fn) {
  const cloud = await loadCloud(name).catch(() => {
    throw new Error(
      `No cloud named "${name}". Create it with: cloud create ${name}`,
    );
  });
  const out = await fn(cloud);
  await saveCloud(cloud);
  return out;
}

program
  .command("create <name>")
  .description("Create a new keyword cloud")
  .option("-t, --target <url>", "The site this cloud is tracked against")
  .action(async (name, opts) => {
    const cloud = await createCloud(name, opts.target);
    console.log(
      chalk.green(`Created cloud "${cloud.name}"`),
      chalk.gray(cloud.target || "(no target)"),
    );
  });

program
  .command("clouds")
  .description("List all clouds")
  .action(async () => {
    const names = await listClouds();
    if (!names.length) return console.log(chalk.yellow("No clouds yet."));
    for (const n of names) {
      const c = await loadCloud(n);
      console.log(
        chalk.bold(n.padEnd(24)),
        chalk.gray(
          `${getTerms(c, STATUS.CORE).length} core, ${getTerms(c, STATUS.CANDIDATE).length} candidate`,
        ),
        chalk.gray(c.target || ""),
      );
    }
  });

program
  .command("list <name>")
  .description("List terms in a cloud")
  .option("-s, --status <status>", "core | candidate | rejected")
  .action(async (name, opts) => {
    const cloud = await loadCloud(name);
    const terms = getTerms(cloud, opts.status);
    if (!terms.length) return console.log(chalk.yellow("No matching terms."));
    for (const t of terms) {
      const colour =
        t.status === STATUS.CORE
          ? chalk.green
          : t.status === STATUS.REJECTED
            ? chalk.red
            : chalk.cyan;
      console.log(
        colour(t.status.padEnd(10)),
        t.phrase.padEnd(44),
        chalk.gray([...new Set(t.sources.map((s) => s.tool))].join(", ")),
      );
    }
    console.log(chalk.gray(`\n${terms.length} term(s)`));
  });

program
  .command("add <name> <phrase>")
  .description("Add a phrase by hand")
  .option("--core", "Add straight into the core set")
  .action(async (name, phrase, opts) => {
    await withCloud(name, (cloud) => {
      const res = addTerm(cloud, phrase, {
        status: opts.core ? STATUS.CORE : STATUS.CANDIDATE,
      });
      console.log(
        res.outcome === "added"
          ? chalk.green(`Added: ${res.term.phrase}`)
          : chalk.yellow(`Already present (${res.outcome})`),
      );
    });
  });

program
  .command("promote <name> <phrase>")
  .description("Move a phrase into the core set")
  .action(async (name, phrase) => {
    await withCloud(name, (cloud) => {
      const t = promoteTerm(cloud, phrase);
      console.log(chalk.green(`Promoted: ${t.phrase}`));
    });
  });

program
  .command("reject <name> <phrase>")
  .description("Reject a phrase so tools stop re-proposing it")
  .action(async (name, phrase) => {
    await withCloud(name, (cloud) => {
      const t = rejectTerm(cloud, phrase);
      console.log(chalk.red(`Rejected: ${t.phrase}`));
    });
  });

program
  .command("propose-completions <name>")
  .description("Propose terms from live Google query completions")
  .requiredOption("--seed <phrase>", "Seed phrase")
  .option("-c, --cascade", "Cascade the seed word by word", false)
  .option(
    "-d, --delay <ms>",
    "Pause for completions to populate",
    (v) => parseInt(v),
    1200,
  )
  .action(async (name, opts) => {
    await withCloud(name, async (cloud) => {
      const res = await proposeFromCompletions(cloud, opts.seed, opts);
      reportProposal("googled", res);
    });
  });

program
  .command("propose-page <name>")
  .description("Propose terms from the n-grams on a page")
  .option("--url <url>", "Page to read (defaults to the cloud target)")
  .option("-m, --min-count <n>", "Minimum occurrences", (v) => parseInt(v), 3)
  .action(async (name, opts) => {
    await withCloud(name, async (cloud) => {
      const url = opts.url || cloud.target;
      if (!url) throw new Error("No --url and the cloud has no target");
      const res = await proposeFromPage(cloud, url, {
        minCount: opts.minCount,
      });
      reportProposal(`keywords(${url})`, res);
    });
  });

program
  .command("propose-competitors <name>")
  .description("Propose terms from the pages currently ranking for a phrase")
  .requiredOption("--phrase <phrase>", "Phrase to look up")
  .option(
    "-n, --top <n>",
    "How many ranked pages to scan",
    (v) => parseInt(v),
    3,
  )
  .action(async (name, opts) => {
    await withCloud(name, async (cloud) => {
      const res = await proposeFromCompetitors(cloud, opts.phrase, {
        topN: opts.top,
      });
      if (res.ranking && res.ranking.status !== "ranked") {
        console.log(
          chalk.yellow(
            `Could not read the SERP: ${res.ranking.status} — ${res.ranking.reason || ""}`,
          ),
        );
        return;
      }
      reportProposal(`ranked+keywords (${res.pagesScanned} pages)`, res);
    });
  });

program
  .command("propose-related <name>")
  .description("Propose semantically related words via Datamuse")
  .requiredOption("--seed <word>", "Seed word")
  .option("--rel <param>", "Datamuse relation (ml, trg, syn, ...)", "ml")
  .action(async (name, opts) => {
    await withCloud(name, async (cloud) => {
      const res = await proposeFromRelated(cloud, opts.seed, { rel: opts.rel });
      reportProposal(`datamuse(${opts.rel})`, res);
    });
  });

program
  .command("rankings <name>")
  .description("Check where the target ranks for each core term (throttled)")
  .option(
    "-d, --delay <ms>",
    "Delay between Google requests",
    (v) => parseInt(v),
    5000,
  )
  .action(async (name, opts) => {
    await withCloud(name, async (cloud) => {
      const core = getTerms(cloud, STATUS.CORE);
      if (!core.length)
        return console.log(chalk.yellow("No core terms. Promote some first."));
      console.log(
        chalk.gray(
          `Checking ${core.length} term(s) with a ${opts.delay}ms delay...\n`,
        ),
      );
      const rows = await checkRankings(cloud, {
        delay: opts.delay,
        onProgress: (i, total, phrase) =>
          process.stdout.write(chalk.gray(`  [${i}/${total}] ${phrase}\r`)),
      });
      process.stdout.write("\n");
      for (const r of rows) {
        if (r.status === "ranked") {
          console.log(
            chalk.green(`#${String(r.position).padEnd(3)}`),
            r.phrase,
          );
        } else if (r.status === "not_in_results") {
          console.log(
            chalk.yellow("—   "),
            r.phrase,
            chalk.gray(`(not in top ${r.totalResults})`),
          );
        } else {
          console.log(
            chalk.red(r.status.padEnd(4)),
            r.phrase,
            chalk.gray(r.reason || ""),
          );
        }
      }
      const blocked = rows.filter((r) => r.status === "blocked").length;
      if (blocked) {
        console.log(
          chalk.yellow(
            `\n${blocked} check(s) were blocked and recorded as such, not as "not ranking". Raise --delay and re-run.`,
          ),
        );
      }
    });
  });

program
  .command("coverage <name>")
  .description("Check whether core terms actually appear in the page content")
  .option("--url <url>", "Page to check (defaults to the cloud target)")
  .action(async (name, opts) => {
    await withCloud(name, async (cloud) => {
      const rows = await checkCoverage(cloud, opts.url);
      if (!rows.length)
        return console.log(chalk.yellow("No core terms to check."));
      for (const r of rows) {
        console.log(
          r.present ? chalk.green("✔") : chalk.red("✖"),
          r.phrase.padEnd(44),
          chalk.gray(r.present ? `${r.occurrences}x` : "absent"),
        );
      }
      const missing = rows.filter((r) => !r.present).length;
      console.log(
        chalk.gray(
          `\n${rows.length - missing}/${rows.length} core terms present on the page`,
        ),
      );
    });
  });

program
  .command("report <name>")
  .description("Show current position, movement, and on-page coverage")
  .action(async (name) => {
    const cloud = await loadCloud(name);
    const rep = buildReport(cloud);
    console.log(chalk.bold(`\n${rep.cloud}`), chalk.gray(rep.target || ""));
    console.log(
      chalk.gray(
        `${rep.counts.core} core, ${rep.counts.candidate} candidate, ${rep.counts.rejected} rejected`,
      ),
    );
    if (!rep.rows.length)
      return console.log(chalk.yellow("\nNo core terms yet."));
    console.log();
    console.log(chalk.gray("POS   Δ      ON-PAGE  TERM"));
    for (const r of rep.rows) {
      const pos = r.position
        ? `#${r.position}`
        : r.rankStatus === "unchecked"
          ? "?"
          : "—";
      const delta =
        r.delta === null
          ? ""
          : r.delta > 0
            ? chalk.green(`+${r.delta}`)
            : r.delta < 0
              ? chalk.red(`${r.delta}`)
              : chalk.gray("0");
      const onPage =
        r.onPage === null
          ? chalk.gray("?")
          : r.onPage
            ? chalk.green("yes")
            : chalk.red("no");
      console.log(
        pos.padEnd(6),
        String(delta || "").padEnd(15),
        onPage.padEnd(16),
        r.phrase,
      );
    }
    if (rep.blockedChecks) {
      console.log(
        chalk.yellow(
          `\n${rep.blockedChecks} historical check(s) were blocked and are excluded from the trend.`,
        ),
      );
    }
  });

// Importing the research modules creates browserless instances that keep the
// event loop alive, so every command must exit explicitly or the CLI hangs
// after printing its output. Doing it here covers all commands at once.
program
  .parseAsync(process.argv)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(chalk.red(`Error: ${e.message}`));
    process.exit(1);
  });
