import { useQuery } from "@tanstack/react-query";
import type { Bootstrap } from "@ekonobar/shared/api/waiter";
import { apiGet } from "./client";

/**
 * One request the home screen can render from.
 *
 * Cold start used to fan out into six to eight parallel calls before anything
 * could be drawn. This collapses the *shell* into one round trip; the lists
 * still load from their own endpoints behind it, which is why the response
 * stays a fixed small size no matter how much history an account has.
 *
 * Short staleTime rather than none: switching tabs should not re-fetch it, but
 * returning to the app after a while should.
 */
export const useBootstrap = () =>
  useQuery({
    queryKey: ["bootstrap"],
    queryFn:  () => apiGet<Bootstrap>("/api/mobile/bootstrap"),
    staleTime: 60 * 1000,
  });
