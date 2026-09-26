/** Timestamps are SQLite UTC text; Date would otherwise read them as local. */
export function parseStamp(value: string | null): Date | null {
  if (!value) return null;
  const d = value.includes("T")
    ? new Date(value)
    : new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function ago(value: string | null, now = Date.now()): string {
  const d = parseStamp(value);
  if (!d) return "—";
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/** How long something took, or has been going. */
export function duration(
  from: string | null,
  to: string | null,
  now = Date.now(),
): string {
  const start = parseStamp(from);
  if (!start) return "—";
  const end = parseStamp(to)?.getTime() ?? now;
  const s = Math.max(0, Math.round((end - start.getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m}m ${s % 60}s` : `${m}m`;
}
