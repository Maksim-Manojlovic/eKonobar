import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";

interface UseRequireRoleOpts {
  /**
   * Full login URL including any query string.
   * Defaults to "/login".
   * Use when the page should redirect back after login, e.g.
   *   loginUrl: `/login?callbackUrl=/apply/${jobId}`
   */
  loginUrl?: string;
}

/**
 * Guards a client page behind role-based auth.
 *
 * - Unauthenticated → pushes to `loginUrl` (default "/login")
 * - Wrong role      → pushes to "/"
 * - Loading / authorized → no redirect
 *
 * Returns `{ session, status }` so the page can still read session data.
 *
 * Usage:
 *   const { session, status } = useRequireRole("VENUE_OWNER");
 *   if (status === "loading") return <PageSkeleton />;
 */
export function useRequireRole(required: Role, opts?: UseRequireRoleOpts) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(opts?.loginUrl ?? "/login");
    }
    if (status === "authenticated" && session?.user.role !== required) {
      router.push("/");
    }
  }, [status, session, router, required, opts?.loginUrl]);

  return { session, status };
}
