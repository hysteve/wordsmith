"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-render the server tree on an interval while work is in flight.
 *
 * A job's progress lives in the database, so the honest way to show it is to
 * ask the server again rather than mirror it into client state that can
 * disagree. Polling stops when nothing is active, so an idle page is idle.
 */
export function AutoRefresh({
  active,
  intervalMs = 2000,
}: {
  active: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, router]);

  return null;
}
