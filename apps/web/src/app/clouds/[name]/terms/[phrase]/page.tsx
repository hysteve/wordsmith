import { notFound } from "next/navigation";
import { observations, sites } from "@wordsmith/core/store/index.ts";
import { loadCloud, findTerm, roleOf } from "@wordsmith/core/services/cloud.js";
import { RankChart } from "@/components/rank-trend";
import {
  Card,
  CardHeader,
  Crumb,
  Empty,
  PageHeading,
  Pill,
  QualityTag,
  Td,
  Th,
} from "@/components/ui";
import { formatPosition } from "@/lib/quality";

/**
 * Always render on request — see the note on the cloud page. These are live
 * measurements and must never be served from a build-time snapshot.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ name: string; phrase: string }> };

export async function generateMetadata({ params }: Props) {
  const { phrase } = await params;
  return { title: `${decodeURIComponent(phrase)} — Wordsmith` };
}

export default async function TermPage({ params }: Props) {
  const { name: rawName, phrase: rawPhrase } = await params;
  const name = decodeURIComponent(rawName);
  const phrase = decodeURIComponent(rawPhrase);

  const cloud = await loadCloud(name).catch((error: unknown) => {
    if ((error as { code?: string })?.code === "ENOENT") return null;
    throw error;
  });
  if (!cloud) notFound();

  const term = findTerm(cloud, phrase);
  if (!term) notFound();

  const site = cloud.target ? await sites.siteFor(cloud.target) : null;
  const [history, competitors] = await Promise.all([
    site
      ? observations.rankHistory(term.phrase, { siteId: site.id, limit: 200 })
      : [],
    observations.serpCompetitors(term.phrase, 12),
  ]);

  const measured = history.filter((h: any) => h.quality === "measured");
  const blocked = history.filter((h: any) => h.quality === "blocked").length;
  const best = measured.length
    ? Math.min(...measured.map((h: any) => h.position))
    : null;
  const current = measured.at(-1) ?? null;

  return (
    <>
      <div className="mb-2">
        <Crumb href={`/clouds/${encodeURIComponent(cloud.name)}`}>
          ← {cloud.name}
        </Crumb>
      </div>

      <PageHeading
        title={term.phrase}
        subtitle={cloud.target ?? undefined}
        action={
          <span className="flex items-center gap-2">
            <Pill tone={term.status === "core" ? "core" : "candidate"}>
              {term.status}
            </Pill>
            <Pill>{roleOf(term)}</Pill>
          </span>
        }
      />

      <Card className="mb-6">
        <div className="grid grid-cols-2 divide-x divide-line-soft sm:grid-cols-4">
          <div className="px-4 py-3">
            <div className="text-2xl leading-none">
              {current ? current.position : "—"}
            </div>
            <div className="mt-1.5 text-xs text-ink-soft">Current position</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-2xl leading-none">{best ?? "—"}</div>
            <div className="mt-1.5 text-xs text-ink-soft">Best seen</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-2xl leading-none">{measured.length}</div>
            <div className="mt-1.5 text-xs text-ink-soft">Measured checks</div>
          </div>
          <div className="px-4 py-3">
            <div
              className={`text-2xl leading-none ${blocked ? "text-blocked" : ""}`}
            >
              {blocked}
            </div>
            <div className="mt-1.5 text-xs text-ink-soft">Blocked checks</div>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader
          title="Position over time"
          hint="the axis is inverted — position 1 is at the top"
        />
        <div className="px-4 py-4">
          <RankChart points={history as any} />
          {blocked > 0 ? (
            <p className="mt-2 text-xs text-ink-faint">
              Dashed lines are checks that were refused. The line breaks across
              them rather than joining, because a blocked check is missing data
              and not a position.
            </p>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Who else ranks"
            hint="across every recorded SERP"
          />
          {competitors.length === 0 ? (
            <Empty>No SERP has been captured for this phrase yet.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Host</Th>
                  <Th className="w-20 text-right">Best</Th>
                  <Th className="w-24 text-right">Appearances</Th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((c: any) => (
                  <tr key={c.host ?? "unknown"}>
                    <Td className="truncate">{c.host ?? "—"}</Td>
                    <Td className="nums text-right">{c.bestRank}</Td>
                    <Td className="nums text-right text-ink-soft">
                      {c.appearances}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader title="Every check" hint="newest first" />
          {history.length === 0 ? (
            <Empty>This phrase has never been checked.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th className="w-20 text-right">Position</Th>
                  <Th className="w-28">Quality</Th>
                  <Th className="text-right">When</Th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h: any) => (
                  <tr key={h.id}>
                    <Td className="nums text-right">
                      {formatPosition(h.position, h.quality)}
                    </Td>
                    <Td>
                      <QualityTag quality={h.quality} />
                    </Td>
                    <Td className="nums text-right text-xs text-ink-faint">
                      {h.observedAt}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
