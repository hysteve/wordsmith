import { addPhrase, queueCoverage, queueRankings } from "@/app/actions";

const BUTTON =
  "rounded border border-line px-3 py-1.5 text-sm hover:border-ink-faint whitespace-nowrap";

export function AddPhraseForm({ cloud }: { cloud: string }) {
  return (
    <form action={addPhrase} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="cloud" value={cloud} />
      <input
        name="phrase"
        required
        placeholder="add a phrase"
        className="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-ink-faint"
      />
      <label
        className="flex items-center gap-1.5 text-xs text-ink-soft"
        title="Skip the candidate step and track it immediately"
      >
        <input type="checkbox" name="core" /> as core
      </label>
      <button type="submit" className={BUTTON}>
        Add
      </button>
    </form>
  );
}

/**
 * Both of these are minutes of work, so they queue. The button says so — a
 * control that looks instant and is not is how a tool loses trust.
 */
export function MeasureForms({
  cloud,
  target,
  coreCount,
}: {
  cloud: string;
  target: string | null;
  coreCount: number;
}) {
  const disabled = coreCount === 0;

  return (
    <div className="flex flex-wrap gap-2">
      <form action={queueRankings}>
        <input type="hidden" name="cloud" value={cloud} />
        <button
          type="submit"
          disabled={disabled}
          className={`${BUTTON} disabled:cursor-not-allowed disabled:opacity-40`}
          title={
            disabled
              ? "Promote a term into the core set first"
              : `Queue a throttled ranking check for ${coreCount} core term(s)`
          }
        >
          Queue rankings ({coreCount})
        </button>
      </form>

      <form action={queueCoverage}>
        <input type="hidden" name="cloud" value={cloud} />
        <input type="hidden" name="url" value={target ?? ""} />
        <button
          type="submit"
          disabled={disabled || !target}
          className={`${BUTTON} disabled:cursor-not-allowed disabled:opacity-40`}
          title={
            target
              ? `Check whether each core term is on ${target}`
              : "This cloud has no target URL"
          }
        >
          Queue coverage
        </button>
      </form>
    </div>
  );
}
