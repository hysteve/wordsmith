"use client";

import { useEffect, useRef, useState } from "react";
import { cancelJob } from "@/app/actions";
import { ago, duration } from "@/lib/time";

export type ActivityItem = {
  key: string;
  runId: number | null;
  jobId: number | null;
  tool: string;
  target: string | null;
  status: string;
  progress: string | null;
  error: string | null;
  result: unknown;
  source: "queue" | "cli";
  at: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  attempts: number | null;
};

const TERMINAL = new Set(["done", "failed", "cancelled", "ok", "error"]);
const FAILED = new Set(["failed", "error"]);

/** The lifecycle, said plainly. The dot repeats it for scanning. */
function phaseOf(status: string): {
  label: string;
  dot: string;
  text: string;
} {
  if (status === "queued")
    return { label: "Queued", dot: "bg-ink-faint", text: "text-ink-soft" };
  if (status === "running")
    return {
      label: "Running",
      dot: "bg-blocked animate-pulse",
      text: "text-blocked",
    };
  if (FAILED.has(status))
    return { label: "Failed", dot: "bg-absent", text: "text-absent" };
  if (status === "cancelled")
    return { label: "Cancelled", dot: "bg-ink-faint", text: "text-ink-faint" };
  return { label: "Complete", dot: "bg-measured", text: "text-measured" };
}

function summarizeResult(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const bits: string[] = [];
  if (typeof r.proposed === "number") bits.push(`${r.proposed} proposed`);
  if (typeof r.pagesRead === "number") bits.push(`${r.pagesRead} pages`);
  if (typeof r.checked === "number") bits.push(`${r.checked} checked`);
  if (typeof r.present === "number") bits.push(`${r.present} present`);
  if (typeof r.blocked === "number" && r.blocked)
    bits.push(`${r.blocked} blocked`);
  if (typeof r.terms === "number") bits.push(`${r.terms} terms`);
  if (typeof r.crawled === "number") bits.push(`${r.crawled} crawled`);
  return bits.length ? bits.join(" · ") : null;
}

export function ActivityList({ items }: { items: ActivityItem[] }) {
  // A clock, so "running for 42s" counts up between server refreshes.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  /**
   * Mark what just finished.
   *
   * A row that quietly changes colour between polls is easy to miss, so a
   * transition into a terminal state is highlighted for a few seconds. The
   * previous statuses are kept in a ref because this is a comparison across
   * renders, not state the UI derives from.
   */
  const previous = useRef<Map<string, string>>(new Map());
  const [justFinished, setJustFinished] = useState<Set<string>>(new Set());

  useEffect(() => {
    const before = previous.current;
    const landed: string[] = [];

    for (const item of items) {
      const was = before.get(item.key);
      if (was && was !== item.status && TERMINAL.has(item.status)) {
        landed.push(item.key);
      }
    }
    previous.current = new Map(items.map((i) => [i.key, i.status]));

    if (!landed.length) return;
    setJustFinished((s) => new Set([...s, ...landed]));
    const timer = setTimeout(() => {
      setJustFinished((s) => {
        const next = new Set(s);
        for (const k of landed) next.delete(k);
        return next;
      });
    }, 6000);
    return () => clearTimeout(timer);
  }, [items]);

  if (items.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-ink-faint">
        Nothing yet. Rankings, coverage, audits and proposals all appear here,
        whether you start them from the panel or the CLI.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line-soft">
      {items.map((item) => {
        const phase = phaseOf(item.status);
        const fresh = justFinished.has(item.key);
        const running = item.status === "running";
        const summary = summarizeResult(item.result);

        return (
          <li
            key={item.key}
            className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 transition-colors duration-700 ${
              fresh ? "bg-measured/10" : ""
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`size-1.5 shrink-0 rounded-full ${phase.dot}`}
                aria-hidden
              />
              <span className={`w-[4.5rem] shrink-0 text-xs ${phase.text}`}>
                {phase.label}
              </span>
            </span>

            <span className="font-medium">{item.tool}</span>

            <span className="min-w-0 flex-1 truncate text-xs text-ink-soft">
              {item.target ?? ""}
            </span>

            {item.attempts && item.attempts > 1 ? (
              <span
                className="text-xs text-blocked"
                title={`Retried — attempt ${item.attempts}`}
              >
                ×{item.attempts}
              </span>
            ) : null}

            <span
              className="text-xs text-ink-faint"
              title={
                item.source === "cli"
                  ? "Started from the command line"
                  : "Queued from the panel"
              }
            >
              {item.source}
            </span>

            <span className="nums w-24 shrink-0 text-right text-xs text-ink-faint">
              {running
                ? duration(item.startedAt, null, now)
                : item.status === "queued"
                  ? "waiting"
                  : ago(item.at, now)}
            </span>

            {/* The detail line: what it is doing, what it produced, or why it failed. */}
            {running && item.progress ? (
              <span className="w-full pl-[6.1rem] text-xs text-ink-soft">
                {item.progress}
              </span>
            ) : item.error ? (
              <span className="w-full pl-[6.1rem] text-xs text-absent">
                {item.error}
              </span>
            ) : summary ? (
              <span className="w-full pl-[6.1rem] text-xs text-ink-faint">
                {summary}
              </span>
            ) : null}

            {item.status === "queued" && item.jobId ? (
              <form action={cancelJob} className="w-full pl-[6.1rem]">
                <input type="hidden" name="id" value={item.jobId} />
                <button
                  type="submit"
                  className="text-xs text-ink-faint underline-offset-2 hover:text-ink hover:underline"
                >
                  cancel
                </button>
              </form>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
