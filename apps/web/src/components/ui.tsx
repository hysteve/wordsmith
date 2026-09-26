/**
 * The small shared pieces. Server components — none of this needs interactivity.
 */
import Link from "next/link";
import {
  QUALITY_CLASS,
  QUALITY_HELP,
  QUALITY_LABEL,
  type Quality,
} from "@/lib/quality";

export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-medium tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-1 max-w-[62ch] text-sm text-ink-soft">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-line bg-surface-sunk/50 ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-soft px-4 py-2.5">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        {hint ? <span className="text-xs text-ink-faint">{hint}</span> : null}
      </div>
      {right}
    </div>
  );
}

/** Nothing here yet — say what would put something here. */
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-sm text-ink-faint">{children}</p>;
}

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="px-4 py-3">
      <div className={`nums text-2xl leading-none ${tone ?? ""}`}>{value}</div>
      <div className="mt-1.5 text-xs text-ink-soft">{label}</div>
    </div>
  );
}

/**
 * The qualifier, rendered. `title` carries the explanation so a number on
 * screen can always account for itself.
 */
export function QualityTag({ quality }: { quality: Quality | string }) {
  const q = (
    ["measured", "proxy", "blocked", "absent"].includes(quality)
      ? quality
      : "blocked"
  ) as Quality;

  return (
    <span
      title={QUALITY_HELP[q]}
      className={`text-xs ${QUALITY_CLASS[q]} cursor-help border-b border-dotted border-current/40`}
    >
      {QUALITY_LABEL[q]}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const tone =
    status === "done" || status === "ok"
      ? "bg-measured"
      : status === "failed" || status === "error"
        ? "bg-absent"
        : status === "running"
          ? "bg-blocked animate-pulse"
          : "bg-ink-faint";

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
      <span className={`size-1.5 rounded-full ${tone}`} aria-hidden />
      {status}
    </span>
  );
}

export function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`border-b border-line-soft px-4 py-2 text-left text-xs font-medium text-ink-faint ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`border-b border-line-soft/60 px-4 py-2 align-middle ${className}`}
    >
      {children}
    </td>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "core" | "candidate" | "rejected";
}) {
  const tones = {
    neutral: "border-line text-ink-soft",
    core: "border-measured/40 text-measured",
    candidate: "border-proxy/40 text-proxy",
    rejected: "border-line text-ink-faint line-through",
  };
  return (
    <span className={`rounded border px-1.5 py-0.5 text-xs ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Crumb({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="text-sm text-ink-soft hover:text-ink">
      {children}
    </Link>
  );
}
