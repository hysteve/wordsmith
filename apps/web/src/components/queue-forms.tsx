/**
 * The forms that start work.
 *
 * Plain forms with a Server Action, so they work before JavaScript loads and
 * there is no client state to drift from the database.
 */
import { createNewCloud, queueAudit, queuePropose } from "@/app/actions";

const INPUT =
  "min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-ink-faint";
const BUTTON =
  "rounded border border-line px-3 py-1.5 text-sm hover:border-ink-faint whitespace-nowrap";

/** The first thing anyone does: start tracking a site. */
export function CreateCloudForm() {
  return (
    <form action={createNewCloud} className="flex flex-wrap items-center gap-2">
      <input
        name="name"
        required
        placeholder="name, e.g. mysite"
        className={INPUT}
      />
      <input
        name="target"
        placeholder="https://mysite.com"
        className={INPUT}
        title="The site this cloud is measured against. Rankings and coverage need it."
      />
      <button type="submit" className={BUTTON}>
        Create cloud
      </button>
    </form>
  );
}

export function QueueAuditForm() {
  return (
    <form action={queueAudit} className="flex gap-2">
      <input name="url" required placeholder="example.com" className={INPUT} />
      <button type="submit" className={BUTTON}>
        Queue audit
      </button>
    </form>
  );
}

/**
 * The four ways to find candidate phrases. Each needs a different input, so
 * they are four small forms rather than one with a mode switch — the field you
 * have to fill in should be the field you can see.
 */
export function ProposeForms({
  cloud,
  target,
}: {
  cloud: string;
  target: string | null;
}) {
  return (
    <div className="divide-y divide-line-soft">
      <form
        action={queuePropose}
        className="flex flex-wrap items-center gap-2 px-4 py-3"
      >
        <input type="hidden" name="cloud" value={cloud} />
        <input type="hidden" name="from" value="site" />
        <div className="w-full text-xs text-ink-soft">
          From your whole site — reads the sitemap and keeps what recurs across
          pages. Start here.
        </div>
        <input
          name="url"
          placeholder={target ?? "https://mysite.com"}
          defaultValue={target ?? ""}
          className={INPUT}
        />
        <input
          name="maxPages"
          type="number"
          min={1}
          max={200}
          defaultValue={40}
          title="How many pages to read at most"
          className="w-20 rounded border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-ink-faint"
        />
        <button type="submit" className={BUTTON}>
          Read site
        </button>
      </form>

      <form
        action={queuePropose}
        className="flex flex-wrap items-center gap-2 px-4 py-3"
      >
        <input type="hidden" name="cloud" value={cloud} />
        <input type="hidden" name="from" value="page" />
        <div className="w-full text-xs text-ink-soft">
          From a single page — a thin sample, so prefer the whole site unless
          you mean this page specifically
        </div>
        <input
          name="url"
          placeholder={target ?? "https://mysite.com/page"}
          defaultValue={target ?? ""}
          className={INPUT}
        />
        <button type="submit" className={BUTTON}>
          Read page
        </button>
      </form>

      <form
        action={queuePropose}
        className="flex flex-wrap items-center gap-2 px-4 py-3"
      >
        <input type="hidden" name="cloud" value={cloud} />
        <input type="hidden" name="from" value="completions" />
        <div className="w-full text-xs text-ink-soft">
          From Google&rsquo;s live completions — what people actually type
        </div>
        <input
          name="seed"
          required
          placeholder="seed phrase"
          className={INPUT}
        />
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <input type="checkbox" name="cascade" /> cascade
        </label>
        <button type="submit" className={BUTTON}>
          Ask Google
        </button>
      </form>

      <form
        action={queuePropose}
        className="flex flex-wrap items-center gap-2 px-4 py-3"
      >
        <input type="hidden" name="cloud" value={cloud} />
        <input type="hidden" name="from" value="competitors" />
        <div className="w-full text-xs text-ink-soft">
          From the pages already ranking for a phrase
        </div>
        <input
          name="phrase"
          required
          placeholder="a phrase you want to rank for"
          className={INPUT}
        />
        <button type="submit" className={BUTTON}>
          Read competitors
        </button>
      </form>

      <form
        action={queuePropose}
        className="flex flex-wrap items-center gap-2 px-4 py-3"
      >
        <input type="hidden" name="cloud" value={cloud} />
        <input type="hidden" name="from" value="related" />
        <div className="w-full text-xs text-ink-soft">
          Semantically related words, via Datamuse — no browser, fast
        </div>
        <input name="seed" required placeholder="a word" className={INPUT} />
        <button type="submit" className={BUTTON}>
          Find related
        </button>
      </form>
    </div>
  );
}
