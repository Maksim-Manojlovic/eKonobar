import { useAuth } from "@/auth/AuthProvider";
import WaiterIndex from "@/screens/waiter/index";
import OwnerIndex from "@/screens/owner/index";

/**
 * Route dispatcher.
 *
 * The tab bar keeps five stable slots for every role (see (app)/_layout.tsx), so
 * each route file picks the screen for the signed-in role rather than the router
 * having a different set of routes per role. Keeping the route names fixed is
 * what lets a push notification deep-link to /smene without knowing who will
 * open it.
 *
 * ADMIN and HEADHUNTER fall through to the waiter-shaped screen for now; every
 * call underneath is role-guarded server-side, so they see only what they may.
 */
export default function IndexRoute() {
  const { user } = useAuth();
  return user?.role === "VENUE_OWNER" ? <OwnerIndex /> : <WaiterIndex />;
}
