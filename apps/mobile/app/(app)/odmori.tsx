import { useAuth } from "@/auth/AuthProvider";
import WaiterOdmori from "@/screens/waiter/odmori";
import OwnerOdmori from "@/screens/owner/odmori";

/**
 * Odmori — pushed from Smene, never a tab.
 *
 * The tab bar is full at five slots, and leave is a monthly concern rather than
 * a daily one, so it lives one tap inside the calendar it affects. Both roles
 * reach it from the same route name so a LEAVE_* notification can deep-link
 * here without knowing who will open it.
 */
export default function OdmoriRoute() {
  const { user } = useAuth();
  if (user?.role === "VENUE_OWNER") return <OwnerOdmori />;
  return <WaiterOdmori />;
}
