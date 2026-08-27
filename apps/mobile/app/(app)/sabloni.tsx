import OwnerSabloni from "@/screens/owner/sabloni";

/**
 * Šabloni — owner-only, pushed from Smene.
 *
 * The route underneath also accepts a head waiter, but there is no head-waiter
 * shell in the app yet, so this is not role-dispatched. The endpoint stays
 * authorised server-side either way.
 */
export default function SabloniRoute() {
  return <OwnerSabloni />;
}
