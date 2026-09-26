/**
 * Rank over time.
 *
 * Two things make this chart different from a normal line:
 *
 *   1. **The y axis is inverted.** Position 1 is the best result, so up means
 *      better. An un-inverted rank chart reads exactly backwards, which is why
 *      the axis is labelled rather than left to be inferred.
 *   2. **A blocked check breaks the line.** Google returns an empty result set
 *      both when you do not rank and when it has throttled you, and the store
 *      keeps those apart. Joining across a blocked check would draw a
 *      confident line through a measurement nobody took, so the path splits
 *      and the moment is marked on the baseline instead.
 *
 * Single series per chart — a cloud has more core terms than a multi-line
 * chart can distinguish, so these are small multiples, one per term. No legend
 * is needed when there is one line and the row names it.
 */

export type RankPoint = {
  position: number | null;
  quality: string;
  observedAt: string;
};

type Props = {
  points: RankPoint[];
  width?: number;
  height?: number;
  /** Worst rank to plot; deeper results are clamped so the shape stays legible. */
  floor?: number;
};

export function RankTrend({
  points,
  width = 104,
  height = 28,
  floor = 30,
}: Props) {
  if (points.length === 0) {
    return <span className="text-xs text-ink-faint">no history</span>;
  }

  const pad = 3;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const worst = Math.min(
    floor,
    Math.max(10, ...points.map((p) => p.position ?? 0)),
  );

  const x = (i: number) =>
    points.length === 1
      ? pad + innerW / 2
      : pad + (i / (points.length - 1)) * innerW;

  // Inverted: position 1 sits at the top.
  const y = (position: number) => {
    const clamped = Math.min(Math.max(position, 1), worst);
    return pad + ((clamped - 1) / (worst - 1)) * innerH;
  };

  // Split into runs of consecutive measured points. Each run is its own path,
  // so a gap is a gap rather than an interpolation.
  const runs: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];
  points.forEach((p, i) => {
    if (p.quality === "measured" && p.position !== null) {
      current.push({ x: x(i), y: y(p.position) });
    } else if (current.length) {
      runs.push(current);
      current = [];
    }
  });
  if (current.length) runs.push(current);

  const blocked = points
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.quality === "blocked");

  const last = [...points].reverse().find((p) => p.quality === "measured");
  const lastIndex = points.findIndex((p) => p === last);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={
        last
          ? `Rank trend, most recent position ${last.position}. Lower is better.`
          : "Rank trend, no measured positions."
      }
      className="overflow-visible"
    >
      {/* A check that was refused: marked, but given no position. */}
      {blocked.map(({ i }) => (
        <line
          key={`b${i}`}
          x1={x(i)}
          x2={x(i)}
          y1={pad}
          y2={height - pad}
          className="stroke-blocked/35"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      ))}

      {runs.map((run, i) => (
        <path
          key={i}
          d={run
            .map((pt, j) => `${j === 0 ? "M" : "L"}${pt.x},${pt.y}`)
            .join(" ")}
          fill="none"
          className="stroke-ink-faint"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* A single measured point has no line to sit on, so show the dot. */}
      {runs.map((run, i) =>
        run.length === 1 ? (
          <circle
            key={`d${i}`}
            cx={run[0].x}
            cy={run[0].y}
            r={2}
            className="fill-ink-faint"
          />
        ) : null,
      )}

      {last && last.position !== null ? (
        <circle
          cx={x(lastIndex)}
          cy={y(last.position)}
          r={2.5}
          className="fill-measured"
        />
      ) : null}
    </svg>
  );
}

/**
 * The full-size version, with an axis. Used on a single phrase's page where
 * there is room to read exact positions.
 */
export function RankChart({ points }: { points: RankPoint[] }) {
  const width = 720;
  const height = 240;
  const padL = 34;
  const padR = 16;
  const padY = 16;
  const innerW = width - padL - padR;
  const innerH = height - padY * 2;

  const measured = points.filter(
    (p) => p.quality === "measured" && p.position !== null,
  );
  if (measured.length === 0) {
    return (
      <p className="px-4 py-8 text-sm text-ink-faint">
        No measured positions yet. A blocked check is not a position — queue
        another sweep with a longer delay.
      </p>
    );
  }

  const worst = Math.max(10, ...measured.map((p) => p.position as number));
  const x = (i: number) =>
    points.length === 1
      ? padL + innerW / 2
      : padL + (i / (points.length - 1)) * innerW;
  const y = (position: number) =>
    padY + ((Math.min(position, worst) - 1) / (worst - 1)) * innerH;

  const ticks = [
    1,
    Math.round(worst / 3),
    Math.round((worst * 2) / 3),
    worst,
  ].filter((t, i, a) => t >= 1 && a.indexOf(t) === i);

  const runs: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];
  points.forEach((p, i) => {
    if (p.quality === "measured" && p.position !== null) {
      current.push({ x: x(i), y: y(p.position) });
    } else if (current.length) {
      runs.push(current);
      current = [];
    }
  });
  if (current.length) runs.push(current);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Search position over time. The axis is inverted: position 1 is at the top."
      className="block"
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={width - padR}
            y1={y(t)}
            y2={y(t)}
            className="stroke-line"
            strokeWidth={1}
          />
          <text
            x={padL - 8}
            y={y(t) + 3.5}
            textAnchor="end"
            className="fill-ink-faint nums"
            fontSize={10}
          >
            {t}
          </text>
        </g>
      ))}

      {points.map((p, i) =>
        p.quality === "blocked" ? (
          <line
            key={`b${i}`}
            x1={x(i)}
            x2={x(i)}
            y1={padY}
            y2={height - padY}
            className="stroke-blocked/40"
            strokeWidth={1}
            strokeDasharray="3 3"
          >
            <title>
              Blocked — the check ran and was refused. Not a position.
            </title>
          </line>
        ) : null,
      )}

      {runs.map((run, i) => (
        <path
          key={i}
          d={run
            .map((pt, j) => `${j === 0 ? "M" : "L"}${pt.x},${pt.y}`)
            .join(" ")}
          fill="none"
          className="stroke-measured"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {points.map((p, i) =>
        p.quality === "measured" && p.position !== null ? (
          <circle
            key={`p${i}`}
            cx={x(i)}
            cy={y(p.position)}
            r={3.5}
            className="fill-measured"
          >
            <title>{`Position ${p.position} on ${p.observedAt}`}</title>
          </circle>
        ) : null,
      )}
    </svg>
  );
}
