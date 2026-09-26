import Link from "next/link";
import { listClouds, loadCloud } from "@wordsmith/core/services/cloud.js";
import { Card, Empty, PageHeading, Pill, Td } from "@/components/ui";

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

export default async function CloudsPage() {
  const names = await listClouds();
  const clouds = await Promise.all(
    names.map(async (name) => {
      const cloud = await loadCloud(name);
      const by = (status: string) =>
        cloud.terms.filter((t: any) => t.status === status).length;
      return {
        name,
        target: cloud.target,
        core: by("core"),
        candidate: by("candidate"),
        rejected: by("rejected"),
      };
    }),
  );

  return (
    <>
      <PageHeading
        title="Clouds"
        subtitle="A cloud is a curated set of phrases. Research proposes candidates, you promote the good ones, and only core terms get measured."
      />

      <Card>
        {clouds.length === 0 ? (
          <Empty>
            No clouds yet. Create one with{" "}
            <code className="font-mono text-xs">
              cloud create &lt;name&gt; --target &lt;url&gt;
            </code>
            .
          </Empty>
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
                    ) : (
                      <div className="text-xs text-ink-faint">
                        no target set
                      </div>
                    )}
                  </Td>
                  <Td className="w-64 text-right">
                    <span className="inline-flex gap-1.5">
                      <Pill tone="core">{c.core} core</Pill>
                      <Pill tone="candidate">{c.candidate} candidate</Pill>
                      {c.rejected ? (
                        <Pill tone="rejected">{c.rejected}</Pill>
                      ) : null}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
