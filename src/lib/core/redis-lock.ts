import { redis } from "@/lib/core/redis";
import crypto from "crypto";

// Lua script: release lock only if the token matches — prevents a slow holder
// from releasing a lock that was already claimed by another request after TTL expiry.
const RELEASE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

export type LockResult =
  | { acquired: true; token: string }
  | { acquired: false; reason: "contended" | "unavailable" };

/**
 * Acquire a distributed lock. Returns the lock token on success.
 * Returns `{ acquired: false, reason }` when:
 *   - "contended"   — another request holds the lock
 *   - "unavailable" — Redis is not configured or threw an error
 *
 * Callers decide the fallback strategy: fail-closed (return 409) for correctness-critical
 * paths, or fail-open (log warning + proceed) for best-effort paths.
 */
export async function acquireLock(key: string, ttlMs = 5000): Promise<LockResult> {
  if (!redis) return { acquired: false, reason: "unavailable" };
  try {
    const token = crypto.randomUUID();
    const ok = await redis.set(key, token, "PX", ttlMs, "NX");
    return ok === "OK"
      ? { acquired: true, token }
      : { acquired: false, reason: "contended" };
  } catch {
    return { acquired: false, reason: "unavailable" };
  }
}

/**
 * Release a previously acquired lock. No-op when Redis is unavailable or
 * the token no longer matches (lock expired and was claimed by another holder).
 */
export async function releaseLock(key: string, token: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.eval(RELEASE_SCRIPT, 1, key, token);
  } catch {
    // Non-fatal — lock expires via TTL if release fails.
  }
}
