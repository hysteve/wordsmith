import { notFound } from "next/navigation";
import { observations, sites } from "@wordsmith/core/store/index.ts";
import {
  loadCloud,
  roleOf,
  getKeywords,
  getQueries,
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
import { QueueProposeForm } from "@/components/queue-forms";
import { formatPosition } from "@/lib/quality";
import { RankTrend } from "@/components/rank-trend";
import Link from "next/link";

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
    const code = (error as { code?: string })?.code;
    if (code === "ENOENT") return null;
    throw error;
  });
  if (!cloud) notFound();

  // Measurements come from the database, not the cloud document: the document
  // owns what we intend to track, the database owns what was observed.
  const site = cloud.target ? await sites.siteFor(cloud.target) : null;
  const [latestRanks, latestCoverage] = site
    ? await Promise.all([
        observations.latestRanks(site.id),
        observations.latestCoverage(site.id),
      ])
    : [[], []];

  const ranks = new Map(latestRanks.map((r: any) => [r.phrase, r]));
  const coverage = new Map(latestCoverage.map((c: any) => [c.phrase, c]));

  // One small multiple per core term. A cloud has more terms than a multi-line
  // chart can keep apart, so each gets its own single-series sparkline.
  const coreTerms = cloud.terms.filter((t: any) => t.status === STATUS.CORE);
  const histories = new Map<string, any[]>(
    site
      ? await Promise.all(
          coreTerms.map(
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

  const core = coreTerms;
  const candidates = cloud.terms.filter(
    (t: any) => t.status === STATUS.CANDIDATE,
  );
  const rejected = cloud.terms.filter((t: any) => t.status === STATUS.REJECTED);

  return (
    <>
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
            coreCount={core.length}
          />
        }
      />

      <Card className="mb-6">
        <CardHeader
          title="Core set"
          hint={`${core.length} tracked — the only terms that get measured`}
        />
        {core.length === 0 ? (
          <Empty>
            Nothing is being tracked yet. Promote a candidate below, and only
            then will rankings and coverage run against it.
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
                {core.map((term: any) => {
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
                            <span className="text-measured">
                              {cov.occurrences}×
                            </span>
                          ) : (
                            <span className="text-absent">absent</span>
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

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Add a phrase" />
          <div className="px-4 py-3">
            <AddPhraseForm cloud={cloud.name} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Propose from Google" hint="completions, queued" />
          <div className="px-4 py-3">
            <QueueProposeForm />
            <p className="mt-2 text-xs text-ink-faint">
              Completion order suggests popularity. It is not search volume, and
              it is stored as a proxy so nothing treats it as one.
            </p>
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader
          title="Candidates"
          hint={`${candidates.length} awaiting a decision`}
        />
        {candidates.length === 0 ? (
          <Empty>
            No candidates. Research tools propose them; nothing enters the core
            set without you promoting it.
          </Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Phrase</Th>
                <Th className="w-24">Role</Th>
                <Th className="w-32">Found by</Th>
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
                  <Td className="text-xs text-ink-faint">
                    {[...new Set(term.sources.map((s: any) => s.tool))].join(
                      ", ",
                    )}
                  </Td>
                  <Td className="text-right">
                    <span className="inline-flex gap-1.5">
                      <PromoteButton cloud={cloud.name} phrase={term.phrase} />
                      <RejectButton cloud={cloud.name} phrase={term.phrase} />
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
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
