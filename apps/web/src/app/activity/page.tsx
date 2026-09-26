import { activity } from "@wordsmith/core/store/index.ts";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActivityList } from "@/components/activity-list";
import { Card, CardHeader, PageHeading } from "@/components/ui";

/**
 * Always render on request — these are live measurements, and a build-time
 * snapshot served as current is the failure the store's quality rules exist to
 * prevent.
 */
export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const [items, active] = await Promise.all([
    activity.recentActivity(80),
    activity.hasActiveWork(),
  ]);

  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <AutoRefresh active={active} />

      <PageHeading
        title="Activity"
        subtitle="Everything this tool has done, queued or finished, from the panel or the command line. The worker takes one job at a time on purpose — two concurrent Google scrapes get both of them blocked."
      />

      <Card>
        <CardHeader
          title="Timeline"
          hint={active ? "updating live" : "idle"}
          right={
            <span className="flex gap-3 text-xs text-ink-faint">
              {counts.queued ? <span>{counts.queued} queued</span> : null}
              {counts.running ? (
                <span className="text-blocked">{counts.running} running</span>
              ) : null}
              {counts.failed ? (
                <span className="text-absent">{counts.failed} failed</span>
              ) : null}
            </span>
          }
        />
        <ActivityList items={items as never} />
      </Card>
    </>
  );
}
