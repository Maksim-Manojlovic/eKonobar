import OwnerEkipa from "@/screens/owner/ekipa";

/**
 * Ekipa — owner-only, pushed from Profil.
 *
 * No role dispatch: a waiter has no roster to manage, and the route is not
 * registered as a tab for any role, so there is nothing to fall through to.
 * The endpoint underneath is authorised server-side regardless.
 */
export default function EkipaRoute() {
  return <OwnerEkipa />;
}
