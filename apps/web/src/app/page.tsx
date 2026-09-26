import Link from "next/link";
import { jobs, runs, sites } from "@wordsmith/core/store/index.ts";
import { listClouds, loadCloud } from "@wordsmith/core/services/cloud.js";
import {
  Card,
  CardHeader,
  Empty,
  PageHeading,
  Stat,
  StatusDot,
  Td,
  Th,
} from "@/components/ui";
import { CreateCloudForm, QueueAuditForm } from "@/components/queue-forms";

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

async function cloudSummaries() {
  const names = await listClouds();
  return Promise.all(
    names.map(async (name) => {
      const cloud = await loadCloud(name);
      const core = cloud.terms.filter((t: any) => t.status === "core").length;
      const candidate = cloud.terms.filter(
        (t: any) => t.status === "candidate",
      ).length;
      return { name, target: cloud.target, core, candidate };
    }),
  );
}

export default async function OverviewPage() {
  const [clouds, queued, running, recentJobs, recentRuns, allSites] =
    await Promise.all([
      cloudSummaries(),
      jobs.listJobs({ status: "queued", limit: 100 }),
      jobs.listJobs({ status: "running", limit: 10 }),
      jobs.listJobs({ limit: 8 }),
      runs.recentRuns(8),
      sites.listSites(),
    ]);

  return (
    <>
      <PageHeading
        title="Overview"
        subtitle="Curation happens here; measurement happens on the queue. Nothing on this page waits for a scrape."
      />

      <Card className="mb-6">
        <div className="grid grid-cols-2 divide-x divide-line-soft sm:grid-cols-4">
          <Stat label="Clouds" value={clouds.length} />
          <Stat label="Sites tracked" value={allSites.length} />
          <Stat
            label="Queued"
            value={queued.length}
            tone={queued.length ? "text-blocked" : undefined}
          />
          <Stat
            label="Running"
            value={running.length}
            tone={running.length ? "text-measured" : undefined}
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Start tracking a site" />
          <div className="px-4 py-3">
            <CreateCloudForm />
            <p className="mt-2 text-xs text-ink-faint">
              A cloud is a set of phrases measured against one site. Give it a
              target and the ranking and coverage checks have something to aim
              at.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Clouds" hint="tracked keyword sets" />
          {clouds.length === 0 ? (
            <Empty>No clouds yet — create one above to begin.</Empty>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {clouds.map((c) => (
                  <tr key={c.name}>
                    <Td>
                      <Link
                        href={`/clouds/${encodeURIComponent(c.name)}`}
                        className="font-medium hover:underline"
                      >
                        {c.name}
                      </Link>
                      {c.target ? (
                        <div className="text-xs text-ink-faint">{c.target}</div>
                      ) : null}
                    </Td>
                    <Td className="nums w-28 text-right text-xs text-ink-soft">
                      {c.core} core
                      <span className="text-ink-faint">
                        {" "}
                        / {c.candidate} cand
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent jobs"
            right={
              <Link
                href="/jobs"
                className="text-xs text-ink-soft hover:text-ink"
              >
                all jobs →
              </Link>
            }
          />
          {recentJobs.length === 0 ? (
            <Empty>Nothing has been queued yet.</Empty>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {recentJobs.map((job) => (
                  <tr key={job.id}>
                    <Td className="w-10 nums text-xs text-ink-faint">
                      {job.id}
                    </Td>
                    <Td>{job.kind}</Td>
                    <Td className="text-right">
                      <StatusDot status={job.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader title="Run an audit" hint="queued, not immediate" />
          <div className="px-4 py-3">
            <QueueAuditForm />
            <p className="mt-2 text-xs text-ink-faint">
              Nine audits against one URL is several minutes of browser work, so
              it runs on the queue.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent runs"
            hint="provenance"
            right={
              <Link
                href="/runs"
                className="text-xs text-ink-soft hover:text-ink"
              >
                all runs →
              </Link>
            }
          />
          {recentRuns.length === 0 ? (
            <Empty>No measurements taken yet.</Empty>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id}>
                    <Td>{run.tool}</Td>
                    <Td className="max-w-[16ch] truncate text-xs text-ink-faint">
                      {run.target ?? "—"}
                    </Td>
                    <Td className="text-right">
                      <StatusDot status={run.status} />
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
