import { jobs } from "@wordsmith/core/store/index.ts";
import { AutoRefresh } from "@/components/auto-refresh";
import { CancelButton } from "@/components/job-actions";
import {
  Card,
  CardHeader,
  Empty,
  PageHeading,
  StatusDot,
  Td,
  Th,
} from "@/components/ui";

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

function relative(from: string | null): string {
  if (!from) return "—";
  // Stored as SQLite UTC text; Date would otherwise read it as local time.
  const then = new Date(`${from.replace(" ", "T")}Z`).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

function summarize(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  if (typeof p.url === "string") return p.url;
  if (typeof p.seed === "string") return `"${p.seed}"`;
  if (Array.isArray(p.phrases)) return `${p.phrases.length} phrase(s)`;
  return "";
}

export default async function JobsPage() {
  const all = await jobs.listJobs({ limit: 60 });
  const active = all.some(
    (j) => j.status === "queued" || j.status === "running",
  );

  return (
    <>
      <AutoRefresh active={active} />

      <PageHeading
        title="Jobs"
        subtitle="Measurement runs here. The worker takes one job at a time on purpose — two concurrent Google scrapes get both of them blocked."
      />

      <Card>
        <CardHeader
          title="Queue"
          hint={active ? "updating live" : "idle"}
          right={
            <span className="text-xs text-ink-faint">
              {all.length} most recent
            </span>
          }
        />
        {all.length === 0 ? (
          <Empty>
            Nothing queued. Rankings, coverage, audits and proposals all run as
            jobs.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th className="w-12">#</Th>
                  <Th className="w-28">Kind</Th>
                  <Th>Target</Th>
                  <Th className="w-28">Status</Th>
                  <Th>Detail</Th>
                  <Th className="w-24 text-right">When</Th>
                  <Th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {all.map((job) => (
                  <tr key={job.id}>
                    <Td className="nums text-xs text-ink-faint">{job.id}</Td>
                    <Td>{job.kind}</Td>
                    <Td className="max-w-[24ch] truncate text-xs text-ink-soft">
                      {summarize(job.payload)}
                    </Td>
                    <Td>
                      <StatusDot status={job.status} />
                      {job.attempts > 1 ? (
                        <span
                          className="ml-1 text-xs text-blocked"
                          title={`Retried — attempt ${job.attempts} of ${job.maxAttempts}`}
                        >
                          ×{job.attempts}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="max-w-[30ch] truncate text-xs">
                      {job.status === "running" && job.progress ? (
                        <span className="text-ink-soft">{job.progress}</span>
                      ) : job.error ? (
                        <span className="text-absent" title={job.error}>
                          {job.error}
                        </span>
                      ) : job.result ? (
                        <span className="text-ink-faint">
                          {JSON.stringify(job.result).slice(0, 60)}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-right text-xs text-ink-faint">
                      {relative(job.finishedAt ?? job.startedAt ?? job.created)}
                    </Td>
                    <Td className="text-right">
                      {job.status === "queued" ? (
                        <CancelButton id={job.id} />
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
