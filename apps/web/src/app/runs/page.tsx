import { runs } from "@wordsmith/core/store/index.ts";
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

export default async function RunsPage() {
  const recent = await runs.recentRuns(80);

  return (
    <>
      <PageHeading
        title="Runs"
        subtitle="Every measurement points at the run that produced it, so any number on this dashboard can say when it was taken and with what arguments."
      />

      <Card>
        <CardHeader title="Recent runs" hint="newest first" />
        {recent.length === 0 ? (
          <Empty>No measurements taken yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th className="w-12">#</Th>
                  <Th className="w-28">Tool</Th>
                  <Th>Target</Th>
                  <Th className="w-24">Status</Th>
                  <Th className="w-20">Source</Th>
                  <Th className="w-40 text-right">Started</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((run) => (
                  <tr key={run.id}>
                    <Td className="nums text-xs text-ink-faint">{run.id}</Td>
                    <Td>{run.tool}</Td>
                    <Td className="max-w-[28ch] truncate text-xs text-ink-soft">
                      {run.target ?? "—"}
                    </Td>
                    <Td>
                      <StatusDot status={run.status} />
                    </Td>
                    <Td className="text-xs text-ink-faint">
                      {run.jobId ? `job ${run.jobId}` : "CLI"}
                    </Td>
                    <Td className="nums text-right text-xs text-ink-faint">
                      {run.startedAt}
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
