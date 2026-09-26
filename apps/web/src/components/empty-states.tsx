/**
 * Empty states that do something.
 *
 * An empty table that says "no data" makes the reader work out what would put
 * data there. Each of these names the next action and offers it inline, so the
 * first run of the tool is a sequence of obvious steps rather than a blank
 * panel and a guess.
 */
import Link from "next/link";
import { queuePropose, queueRankings } from "@/app/actions";
import { AddFromLiveButton } from "@/components/term-actions";

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-6">
      <p className="text-sm">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/**
 * Nothing targeted yet.
 *
 * If the site has been scanned, the top live phrases are the best starting
 * point there is — they are what the site already says, measured, so they need
 * no research to justify. If it has not, the scan is the step.
 */
export function NoTargets({
  cloud,
  target,
  suggestions,
}: {
  cloud: string;
  target: string | null;
  suggestions: Array<{ term: string; total: number; pages: number }>;
}) {
  if (suggestions.length === 0) {
    return (
      <Shell title="No targets yet, and the site has not been read.">
        <form
          action={queuePropose}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="cloud" value={cloud} />
          <input type="hidden" name="from" value="site" />
          <input type="hidden" name="url" value={target ?? ""} />
          <button
            type="submit"
            disabled={!target}
            className="rounded border border-line px-3 py-1.5 text-sm hover:border-ink-faint disabled:opacity-40"
          >
            Read {target ?? "the site"}
          </button>
          <span className="text-xs text-ink-faint">
            Reads the sitemap and finds the phrases your pages already use.
          </span>
        </form>
      </Shell>
    );
  }

  return (
    <Shell title="No targets yet. These are the phrases your site uses most — a good place to start.">
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <span
            key={s.term}
            className="inline-flex items-center gap-1.5 rounded border border-line px-2 py-1 text-sm"
          >
            <span>{s.term}</span>
            <span className="nums text-xs text-ink-faint">
              {s.total}× · {s.pages}p
            </span>
            <AddFromLiveButton cloud={cloud} phrase={s.term} />
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-faint">
        Or find phrases people search for in the{" "}
        <Link
          href={`/clouds/${encodeURIComponent(cloud)}/completions`}
          className="underline underline-offset-2 hover:text-ink"
        >
          completions explorer
        </Link>
        .
      </p>
    </Shell>
  );
}

/** Targets exist but have never been measured. */
export function NoRankings({ cloud, count }: { cloud: string; count: number }) {
  return (
    <Shell
      title={`${count} target${count === 1 ? "" : "s"} set, none measured yet.`}
    >
      <form
        action={queueRankings}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="cloud" value={cloud} />
        <button
          type="submit"
          className="rounded border border-line px-3 py-1.5 text-sm hover:border-ink-faint"
        >
          Check rankings now
        </button>
        <span className="text-xs text-ink-faint">
          Five seconds between each, so Google does not refuse the lot —{count}{" "}
          phrase{count === 1 ? "" : "s"} is roughly{" "}
          {Math.max(1, Math.round((count * 6) / 60))} minute
          {Math.round((count * 6) / 60) === 1 ? "" : "s"}.
        </span>
      </form>
    </Shell>
  );
}

/** Rankings exist but no SERP has been captured, so no competitors. */
export function NoCompetitors({ measured }: { measured: boolean }) {
  return (
    <div className="px-4 py-6 text-sm text-ink-faint">
      {measured
        ? "No results captured yet. A blocked check records no SERP, so there is nobody to compare against — try again with a longer delay."
        : "Competitors come from the search results behind a ranking check. Run one and whoever else appears will be listed here."}
    </div>
  );
}
