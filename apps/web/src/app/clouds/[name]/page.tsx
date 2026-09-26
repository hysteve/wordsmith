import Link from "next/link";
import { notFound } from "next/navigation";
import { activity, observations, sites } from "@wordsmith/core/store/index.ts";
import {
  loadCloud,
  roleOf,
  rollUp,
  STATUS,
} from "@wordsmith/core/services/cloud.js";
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
import { AddPhraseForm, MeasureForms } from "@/components/cloud-forms";
import {
  PromoteButton,
  RejectButton,
  RoleSelect,
} from "@/components/term-actions";
import { ProposeForms } from "@/components/queue-forms";
import { LiveTerms } from "@/components/live-terms";
import { AutoRefresh } from "@/components/auto-refresh";
import { formatPosition } from "@/lib/quality";
import { RankTrend } from "@/components/rank-trend";

/**
 * Always render on request.
 *
 * Every read on this page is a live measurement out of the database. Next
 * prerenders a route that touches no dynamic API, which would freeze these
 * numbers at build time and show them as current — the exact failure the
 * store's `quality` field exists to prevent. A dashboard that lies quietly is
 * worse than no dashboard.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ name: string }> };

export async function generateMetadata({ params }: Props) {
  const { name } = await params;
  return { title: `${decodeURIComponent(name)} — Wordsmith` };
}

export default async function CloudPage({ params }: Props) {
  const { name: raw } = await params;
  const name = decodeURIComponent(raw);

  // Only a missing cloud is a 404. Any other failure should surface as an
  // error, not be flattened into "not found" — that hides real bugs.
  const cloud = await loadCloud(name).catch((error: unknown) => {
    if ((error as { code?: string })?.code === "ENOENT") return null;
    throw error;
  });
  if (!cloud) notFound();

  const targets = cloud.terms.filter((t: any) => t.status === STATUS.CORE);
  const candidates = cloud.terms.filter(
    (t: any) => t.status === STATUS.CANDIDATE,
  );
  const rejected = cloud.terms.filter((t: any) => t.status === STATUS.REJECTED);

  // Measurements come from the database, not the cloud document: the document
  // owns what we intend to track, the database owns what was observed.
  const site = cloud.target ? await sites.siteFor(cloud.target) : null;

  const [latestRanks, latestCoverage, live, lastScan, active] = site
    ? await Promise.all([
        observations.latestRanks(site.id),
        observations.latestCoverage(site.id),
        observations.siteTerms(site.id, { limit: 150, minCount: 3 }),
        observations.lastSiteScan(site.id),
        activity.hasActiveWork(),
      ])
    : [[], [], [], null, false];

  const ranks = new Map(latestRanks.map((r: any) => [r.phrase, r]));
  const coverage = new Map(latestCoverage.map((c: any) => [c.phrase, c]));

  // Every phrase the cloud knows about, so the live list can say which of the
  // things your site already says are actually being tracked.
  const tracked = new Map<string, string>(
    cloud.terms.map((t: any) => [t.phrase, t.status]),
  );

  // One small multiple per target. A cloud has more terms than a multi-line
  // chart can keep apart, so each gets its own single-series sparkline.
  const histories = new Map<string, any[]>(
    site
      ? await Promise.all(
          targets.map(
            async (term: any) =>
              [
                term.phrase,
                await observations.rankHistory(term.phrase, {
                  siteId: site.id,
                  limit: 40,
                }),
              ] as [string, any[]],
          ),
        )
      : [],
  );

  return (
    <>
      <AutoRefresh active={active} />

      <div className="mb-2">
        <Crumb href="/clouds">← Clouds</Crumb>
      </div>

      <PageHeading
        title={cloud.name}
        subtitle={cloud.target ?? "No target URL set for this cloud."}
        action={
          <MeasureForms
            cloud={cloud.name}
            target={cloud.target}
            coreCount={targets.length}
          />
        }
      />

      <Card className="mb-6">
        <CardHeader
          title="Targets"
          hint={`${targets.length} phrases you are trying to own — the only ones measured`}
        />
        {targets.length === 0 ? (
          <Empty>
            Nothing targeted yet. Promote a candidate below, or add something
            your site already says from the live list.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Phrase</Th>
                  <Th className="w-20">Role</Th>
                  <Th className="w-20 text-right">Rank</Th>
                  <Th className="w-28">Trend</Th>
                  <Th className="w-28">Quality</Th>
                  <Th className="w-24 text-right">On page</Th>
                  <Th className="w-40 text-right">Ladder</Th>
                </tr>
              </thead>
              <tbody>
                {targets.map((term: any) => {
                  const rank = ranks.get(term.phrase);
                  const cov = coverage.get(term.phrase);
                  const rolled = rollUp(cloud, term.phrase);
                  const role = roleOf(term);

                  return (
                    <tr key={term.phrase}>
                      <Td>
                        <span className="font-medium">{term.phrase}</span>
                        {term.isQuestion ? (
                          <span
                            className="ml-1.5 text-xs text-ink-faint"
                            title="Phrased as a question"
                          >
                            ?
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        <RoleSelect
                          cloud={cloud.name}
                          phrase={term.phrase}
                          role={role}
                          overridden={Boolean(term.roleOverride)}
                        />
                      </Td>
                      <Td className="nums text-right">
                        {rank ? (
                          <Link
                            href={`/clouds/${encodeURIComponent(cloud.name)}/terms/${encodeURIComponent(term.phrase)}`}
                            className="hover:underline"
                          >
                            {formatPosition(rank.position, rank.quality)}
                          </Link>
                        ) : (
                          <span className="text-ink-faint">unchecked</span>
                        )}
                      </Td>
                      <Td>
                        <RankTrend points={histories.get(term.phrase) ?? []} />
                      </Td>
                      <Td>
                        {rank ? <QualityTag quality={rank.quality} /> : null}
                      </Td>
                      <Td className="nums text-right">
                        {cov ? (
                          cov.present ? (
                            <span
                              className="text-measured"
                              title={`Found ${cov.occurrences} time(s) on ${cov.url}`}
                            >
                              {cov.occurrences}×
                            </span>
                          ) : (
                            <span
                              className="text-absent"
                              title="Targeted, but this phrase is not on the page"
                            >
                              absent
                            </span>
                          )
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </Td>
                      <Td className="text-right text-xs text-ink-soft">
                        {role === "head" || role === "target" ? (
                          rolled.descendants === 0 ? (
                            <span
                              className="text-blocked"
                              title="A goal with nothing tracked underneath it is a wish, not a plan"
                            >
                              unsupported
                            </span>
                          ) : (
                            <span title="Tracked phrases that contain this one, and how many of them rank">
                              {rolled.descendantsRanked}/{rolled.descendants}{" "}
                              ranking
                            </span>
                          )
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <CardHeader
          title="Live on the site"
          hint={
            lastScan
              ? `what your pages say now · scanned ${lastScan}`
              : "what your pages say now"
          }
          right={
            <span className="text-xs text-ink-faint">
              {live.length} phrases
            </span>
          }
        />
        <LiveTerms cloud={cloud.name} terms={live as never} tracked={tracked} />
        <p className="border-t border-line-soft px-4 py-2.5 text-xs text-ink-faint">
          Observed, not chosen. A phrase here that is not a target is something
          you already say and are not measuring; a target that never appears
          here is one you have not written yet.
        </p>
      </Card>

      <Card className="mb-6">
        <CardHeader title="Add a phrase" hint="by hand, straight to targets" />
        <div className="px-4 py-3">
          <AddPhraseForm cloud={cloud.name} />
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader
          title="Find candidates"
          hint="all four queue; nothing becomes a target without you"
        />
        <ProposeForms cloud={cloud.name} target={cloud.target} />
        <p className="border-t border-line-soft px-4 py-2.5 text-xs text-ink-faint">
          Google&rsquo;s completion order suggests popularity. It is not search
          volume, and it is recorded as a proxy so nothing downstream treats it
          as one.
        </p>
      </Card>

      <Card className="mb-6">
        <CardHeader
          title="Candidates"
          hint={`${candidates.length} awaiting a decision — promoting makes one a target`}
        />
        {candidates.length === 0 ? (
          <Empty>
            No candidates. Research tools propose them; nothing becomes a target
            without you promoting it.
          </Empty>
        ) : (
          <div className="max-h-[32rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-sunk">
                <tr>
                  <Th>Phrase</Th>
                  <Th className="w-20">Role</Th>
                  <Th className="w-20 text-right">Times</Th>
                  <Th className="w-20 text-right">Pages</Th>
                  <Th className="w-28">Found by</Th>
                  <Th className="w-36 text-right" />
                </tr>
              </thead>
              <tbody>
                {candidates.map((term: any) => (
                  <tr key={term.phrase}>
                    <Td>{term.phrase}</Td>
                    <Td>
                      <Pill>{roleOf(term)}</Pill>
                    </Td>
                    <Td className="nums text-right">
                      {term.occurrences ? (
                        <span title={`${term.occurrences.density} per page`}>
                          {term.occurrences.total}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                    <Td className="nums text-right text-ink-soft">
                      {term.occurrences?.pages ?? (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                    <Td className="text-xs text-ink-faint">
                      {[...new Set(term.sources.map((s: any) => s.tool))].join(
                        ", ",
                      )}
                    </Td>
                    <Td className="text-right">
                      <span className="inline-flex gap-1.5">
                        <PromoteButton
                          cloud={cloud.name}
                          phrase={term.phrase}
                        />
                        <RejectButton cloud={cloud.name} phrase={term.phrase} />
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {rejected.length > 0 ? (
        <Card>
          <CardHeader
            title="Rejected"
            hint="permanent — re-proposing will not resurrect these"
          />
          <div className="flex flex-wrap gap-1.5 px-4 py-3">
            {rejected.map((term: any) => (
              <Pill key={term.phrase} tone="rejected">
                {term.phrase}
              </Pill>
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}
