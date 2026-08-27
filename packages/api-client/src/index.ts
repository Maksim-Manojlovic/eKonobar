/**
 * @ekonobar/api-client — typed HTTP layer over the eKonobar REST API.
 *
 * Filled in during Phase 1 (bearer auth) and Phase 4 (mobile shell). It will own:
 *   - the base fetch wrapper (base URL, JSON, error shape, x-request-id passthrough)
 *   - the access/refresh token interceptor: refresh once on 401, queue concurrent
 *     requests while the refresh is in flight, sign out if the refresh itself fails
 *   - per-endpoint typed functions built on the Zod schemas in @ekonobar/shared
 *
 * Storage is injected, not imported: the web has cookies, the mobile app has
 * expo-secure-store. This package must not reach for either directly.
 */

export const API_CLIENT_PACKAGE_VERSION = "0.0.0";
