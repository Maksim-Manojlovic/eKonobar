import { useAuth } from "@/auth/AuthProvider";
import WaiterPassport from "@/screens/waiter/passport";
import OwnerPassport from "@/screens/owner/passport";
import AdminPassport from "@/screens/admin/passport";

/**
 * Route dispatcher.
 *
 * The tab bar keeps five stable slots for every role (see (app)/_layout.tsx), so
 * each route file picks the screen for the signed-in role rather than the router
 * having a different set of routes per role. Keeping the route names fixed is
 * what lets a push notification deep-link to /smene without knowing who will
 * open it.
 *
 * HEADHUNTER falls through to the waiter-shaped screen — that role stays web-only
 * in v1, and every call underneath is role-guarded server-side, so it sees only
 * what it may.
 */
export default function PassportRoute() {
  const { user } = useAuth();
  if (user?.role === "ADMIN")       return <AdminPassport />;
  if (user?.role === "VENUE_OWNER") return <OwnerPassport />;
  return <WaiterPassport />;
}
