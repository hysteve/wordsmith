/**
 * The forms that put work on the queue.
 *
 * Plain forms with a Server Action, so they work before JavaScript loads and
 * there is no client state to get out of sync with the database.
 */
import { queueAudit, queuePropose } from "@/app/actions";

export function QueueAuditForm() {
  return (
    <form action={queueAudit} className="flex gap-2">
      <input
        name="url"
        required
        placeholder="example.com"
        className="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-ink-faint"
      />
      <button
        type="submit"
        className="rounded border border-line px-3 py-1.5 text-sm hover:border-ink-faint"
      >
        Queue audit
      </button>
    </form>
  );
}

export function QueueProposeForm() {
  return (
    <form action={queuePropose} className="flex flex-wrap items-center gap-2">
      <input
        name="seed"
        required
        placeholder="seed phrase"
        className="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-ink-faint"
      />
      <label className="flex items-center gap-1.5 text-xs text-ink-soft">
        <input type="checkbox" name="cascade" /> cascade
      </label>
      <button
        type="submit"
        className="rounded border border-line px-3 py-1.5 text-sm hover:border-ink-faint"
      >
        Ask Google
      </button>
    </form>
  );
}
