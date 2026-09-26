import { cancelJob } from "@/app/actions";

export function CancelButton({ id }: { id: number }) {
  return (
    <form action={cancelJob} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded border border-line px-1.5 py-0.5 text-xs text-ink-soft hover:border-ink-faint hover:text-ink"
        title="Only work that has not started can be cancelled — a running job owns a browser"
      >
        cancel
      </button>
    </form>
  );
}
