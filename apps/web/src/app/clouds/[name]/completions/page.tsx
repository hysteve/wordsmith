import { notFound } from "next/navigation";
import { activity, observations } from "@wordsmith/core/store/index.ts";
import { loadCloud } from "@wordsmith/core/services/cloud.js";
import { stopWords } from "@wordsmith/core/data/common-words.js";
import { queuePropose } from "@/app/actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { CompletionPhrase } from "@/components/completion-phrase";
import { Card, CardHeader, Crumb, PageHeading } from "@/components/ui";
import { ago } from "@/lib/time";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ name: string }> };

export async function generateMetadata({ params }: Props) {
  const { name } = await params;
  return { title: `Completions — ${decodeURIComponent(name)}` };
}

export default async function CompletionsPage({ params }: Props) {
  const { name: raw } = await params;
  const name = decodeURIComponent(raw);

  const cloud = await loadCloud(name).catch((error: unknown) => {
    if ((error as { code?: string })?.code === "ENOENT") return null;
    throw error;
  });
  if (!cloud) notFound();

  const [history, active] = await Promise.all([
    observations.completionHistory(name),
    activity.hasActiveWork(),
  ]);

  const tracked = new Map<string, string>(
    cloud.terms.map((t: any) => [t.phrase, t.status]),
  );

  // Seeds already asked, offered back so the same ground is not re-covered by
  // accident — and so re-asking one is a single click when you do mean it.
  const askedBefore = history.map((h) => h.seed);

  return (
    <>
      <AutoRefresh active={active} />

      <div className="mb-2">
        <Crumb href={`/clouds/${encodeURIComponent(cloud.name)}`}>
          ← {cloud.name}
        </Crumb>
      </div>

      <PageHeading
        title="Completions"
        subtitle="What Google offers to finish a phrase with. Ask a seed and the answers land here; ask it again later and the new answers join the old, because what Google suggests drifts and the drift is the signal."
      />

      <Card className="mb-6">
        <CardHeader
          title="Ask a seed"
          hint="gathers only — nothing enters your lists until you pick it"
        />
        <div className="px-4 py-3">
          <form
            action={queuePropose}
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="cloud" value={cloud.name} />
            <input type="hidden" name="from" value="completions" />
            <input type="hidden" name="addCandidates" value="false" />
            <input
              name="seed"
              required
              placeholder="e.g. kava bar"
              className="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-ink-faint"
            />
            <label
              className="flex items-center gap-1.5 text-xs text-ink-soft"
              title="Enter the phrase a word at a time, capturing what Google offers at each step"
            >
              <input type="checkbox" name="cascade" /> cascade
            </label>
            <button
              type="submit"
              className="rounded border border-line px-3 py-1.5 text-sm hover:border-ink-faint"
            >
              Ask Google
            </button>
          </form>

          {askedBefore.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-ink-faint">Asked before:</span>
              {askedBefore.map((seed) => (
                <form key={seed} action={queuePropose} className="inline">
                  <input type="hidden" name="cloud" value={cloud.name} />
                  <input type="hidden" name="from" value="completions" />
                  <input type="hidden" name="addCandidates" value="false" />
                  <input type="hidden" name="seed" value={seed} />
                  <button
                    type="submit"
                    className="rounded border border-line px-1.5 py-0.5 text-xs text-ink-soft hover:border-ink-faint hover:text-ink"
                    title="Ask again — new answers are added, not substituted"
                  >
                    {seed} ↻
                  </button>
                </form>
              ))}
            </div>
          ) : null}
        </div>
      </Card>

      {history.length === 0 ? (
        <Card>
          <p className="px-4 py-8 text-sm text-ink-faint">
            Nothing asked yet. Start with a phrase somebody might type — a
            product, a place, a problem — and Google will show how people
            actually finish it.
          </p>
        </Card>
      ) : (
        history.map((group) => (
          <Card key={group.seed} className="mb-6">
            <CardHeader
              title={group.seed}
              hint={`${group.queries.length} quer${group.queries.length === 1 ? "y" : "ies"}`}
              right={
                <span className="text-xs text-ink-faint">
                  last asked {ago(group.lastSeen)}
                </span>
              }
            />
            <div className="divide-y divide-line-soft">
              {group.queries.map((q) => (
                <div key={q.query} className="px-4 py-3">
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <span className="text-xs text-ink-faint">completing</span>
                    <span className="font-mono text-xs">“{q.query}”</span>
                    <span className="text-xs text-ink-faint">
                      · {q.phrases.length} suggestion
                      {q.phrases.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="divide-y divide-line-soft/50">
                    {q.phrases.map((p) => (
                      <CompletionPhrase
                        key={p.phrase}
                        cloud={cloud.name}
                        phrase={p.phrase}
                        stopWords={stopWords}
                        tracked={tracked.get(p.phrase)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="border-t border-line-soft px-4 py-2 text-xs text-ink-faint">
              Order suggests popularity. It is not search volume, and it is
              recorded as a proxy so nothing downstream treats it as one.
            </p>
          </Card>
        ))
      )}
    </>
  );
}
