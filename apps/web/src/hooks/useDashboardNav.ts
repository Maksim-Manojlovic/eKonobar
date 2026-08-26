import { useState } from "react";

/**
 * Shared navigation state for dashboard pages.
 *
 * Bundles the section switcher, notification unread counter, and the
 * Serbian-locale today string — all three appear identically in every
 * dashboard root component. Generic over <S> so each dashboard keeps its
 * own Section type without a union or any-cast.
 *
 * Usage:
 *   const { section, setSection, notifUnread, setNotifUnread, today } =
 *     useDashboardNav<Section>("overview");
 */
export function useDashboardNav<S extends string>(initial: S) {
  const [section, setSection]         = useState<S>(initial);
  const [notifUnread, setNotifUnread] = useState(0);

  const today = new Date().toLocaleDateString("sr-Latn-RS", {
    weekday: "short",
    day:     "numeric",
    month:   "long",
    year:    "numeric",
  });

  return { section, setSection, notifUnread, setNotifUnread, today };
}
