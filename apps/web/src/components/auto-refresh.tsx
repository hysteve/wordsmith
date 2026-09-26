"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keep the server tree current.
 *
 * Progress lives in the database, so the honest way to show it is to ask the
 * server again rather than mirror it into client state that can disagree.
 *
 * Two cadences. While work is in flight, poll often enough that a job finishing
 * is visible almost immediately. When idle, keep a slow poll rather than
 * stopping: work can be queued from the CLI or another tab, and a page that
 * has gone permanently still looks broken.
 */
export function AutoRefresh({
  active,
  activeMs = 1500,
  idleMs = 15000,
}: {
  active: boolean;
  activeMs?: number;
  idleMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const interval = active ? activeMs : idleMs;
    const timer = setInterval(() => {
      // Don't poll a page nobody is looking at.
      if (document.visibilityState === "visible") router.refresh();
    }, interval);

    // Catch up immediately when the tab comes back.
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, activeMs, idleMs, router]);

  return null;
}
