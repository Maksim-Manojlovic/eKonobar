/**
 * Maps a server notification link onto a route in this app.
 *
 * `Notification.link` is written for the web dashboard ("/dashboard/venue",
 * "/waiter/smene", "/venue/applications"), and the same string is sent to both
 * clients — deliberately, so the server has one notion of where a notification
 * points. Translating it here keeps that decision on the server and means adding
 * a NotificationType needs no coordinated change.
 *
 * Anything unrecognised goes to the home tab. Routing to a path that does not
 * exist would leave the user on a blank screen with no way back.
 */
export type AppRoute = "/" | "/poslovi" | "/smene" | "/recenzije" | "/passport" | "/notifications";

export function mapNotificationLink(link: string | null | undefined): AppRoute {
  if (!link) return "/notifications";
  const l = link.toLowerCase();

  if (l.includes("smene") || l.includes("shift") || l.includes("clockin")) return "/smene";
  if (l.includes("poslov") || l.includes("job") || l.includes("application") || l.includes("invite")) return "/poslovi";
  if (l.includes("recenzij") || l.includes("review")) return "/recenzije";
  if (l.includes("passport") || l.includes("pasos")) return "/passport";
  return "/";
}
