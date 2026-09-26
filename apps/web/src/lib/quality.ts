/**
 * How a measurement's quality becomes something you can see.
 *
 * The store refuses to record a blocked check as an absence, and that
 * distinction is worthless if the UI flattens it back out. A dashboard makes
 * every number look authoritative, so the qualifier has to survive all the way
 * to the pixel: `blocked` is a gap, never a zero, and a proxy never looks like
 * a measurement.
 */
export type Quality = "measured" | "proxy" | "blocked" | "absent";

export const QUALITY_LABEL: Record<Quality, string> = {
  measured: "Measured",
  proxy: "Proxy",
  blocked: "Blocked",
  absent: "Not ranking",
};

export const QUALITY_HELP: Record<Quality, string> = {
  measured: "We saw this in the results; the number is the observation.",
  proxy:
    "A stand-in, not the thing itself — completion order suggests popularity, it is not search volume.",
  blocked:
    "The check ran and was refused, usually throttling. This is missing data, not a bad result.",
  absent: "The check ran and the target genuinely was not in the results.",
};

export const QUALITY_CLASS: Record<Quality, string> = {
  measured: "text-measured",
  proxy: "text-proxy",
  blocked: "text-blocked",
  absent: "text-absent",
};

/**
 * What to print for a position.
 *
 * A blocked check has no position, and printing "—" for it alongside a real
 * "—" for "not ranking" would erase the difference the store went to trouble
 * to keep. Blocked reads as "blocked".
 */
export function formatPosition(
  position: number | null,
  quality: Quality | string,
): string {
  if (quality === "blocked") return "blocked";
  if (position === null || position === undefined) return "—";
  return String(position);
}

/** Positive means the position improved (a smaller number is better). */
export function formatDelta(delta: number | null): {
  text: string;
  tone: "up" | "down" | "flat";
} {
  if (delta === null || delta === 0) return { text: "·", tone: "flat" };
  if (delta > 0) return { text: `+${delta}`, tone: "up" };
  return { text: String(delta), tone: "down" };
}
