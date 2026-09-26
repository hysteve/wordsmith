/**
 * Curation controls. Server Actions in plain forms, so a click is a POST and
 * the page re-renders from the database rather than from optimistic state.
 */
import { changeRole, promote, reject } from "@/app/actions";

const BUTTON =
  "rounded border border-line px-1.5 py-0.5 text-xs text-ink-soft hover:border-ink-faint hover:text-ink";

export function PromoteButton({
  cloud,
  phrase,
}: {
  cloud: string;
  phrase: string;
}) {
  return (
    <form action={promote} className="inline">
      <input type="hidden" name="cloud" value={cloud} />
      <input type="hidden" name="phrase" value={phrase} />
      <button type="submit" className={BUTTON} title="Move into the core set">
        promote
      </button>
    </form>
  );
}

export function RejectButton({
  cloud,
  phrase,
}: {
  cloud: string;
  phrase: string;
}) {
  return (
    <form action={reject} className="inline">
      <input type="hidden" name="cloud" value={cloud} />
      <input type="hidden" name="phrase" value={phrase} />
      <button
        type="submit"
        className={BUTTON}
        title="Rejecting is permanent — re-proposing will not resurrect it"
      >
        reject
      </button>
    </form>
  );
}

/**
 * Role is derived from token count, which is a good default and a bad law, so
 * it can be overridden. An empty value clears the override.
 */
export function RoleSelect({
  cloud,
  phrase,
  role,
  overridden,
}: {
  cloud: string;
  phrase: string;
  role: string;
  overridden: boolean;
}) {
  return (
    <form action={changeRole} className="inline">
      <input type="hidden" name="cloud" value={cloud} />
      <input type="hidden" name="phrase" value={phrase} />
      <select
        name="role"
        defaultValue={overridden ? role : ""}
        className="rounded border border-line bg-surface px-1 py-0.5 text-xs text-ink-soft"
        title={
          overridden
            ? "Overridden; choose “derived” to go back to the token-count default"
            : `Derived from token count: ${role}`
        }
      >
        <option value="">derived ({role})</option>
        <option value="head">head</option>
        <option value="target">target</option>
        <option value="utterance">utterance</option>
      </select>
      <button type="submit" className={`${BUTTON} ml-1`}>
        set
      </button>
    </form>
  );
}
