import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/core/db", () => ({
  dbRaw: {
    tokenRevocation: { findUnique: vi.fn() },
  },
}));

import { dbRaw } from "@/lib/core/db";
import {
  isTokenRevoked,
  _clearRevCacheForTests,
  REV_CACHE_TTL_MS,
  REV_CACHE_TTL_ADMIN_MS,
} from "../revocation";

const USER_ID  = "user-1";
const TOKEN_IAT = 1_000_000; // arbitrary epoch seconds
const REVOKED_AT_SEC = TOKEN_IAT + 10; // revocation happened after token was issued

function mockRevoked(revokedAtSec: number) {
  vi.mocked(dbRaw.tokenRevocation.findUnique).mockResolvedValue({
    revokedAt: new Date(revokedAtSec * 1000),
  } as never);
}

function mockNotRevoked() {
  vi.mocked(dbRaw.tokenRevocation.findUnique).mockResolvedValue(null);
}

describe("isTokenRevoked", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    _clearRevCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when no revocation record exists", async () => {
    mockNotRevoked();
    expect(await isTokenRevoked(USER_ID, TOKEN_IAT)).toBe(false);
    expect(dbRaw.tokenRevocation.findUnique).toHaveBeenCalledOnce();
  });

  it("returns true when token was issued before revocation", async () => {
    mockRevoked(REVOKED_AT_SEC);
    expect(await isTokenRevoked(USER_ID, TOKEN_IAT)).toBe(true);
  });

  it("returns false when token was issued after revocation (re-login after ban)", async () => {
    // Token iat is *after* revokedAt — user re-logged in since the ban
    mockRevoked(TOKEN_IAT - 5);
    expect(await isTokenRevoked(USER_ID, TOKEN_IAT)).toBe(false);
  });

  // ── Cache TTL behaviour ────────────────────────────────────────────────────

  it("non-ADMIN: serves cached result within 60 s window", async () => {
    mockNotRevoked();
    await isTokenRevoked(USER_ID, TOKEN_IAT, "WAITER");         // cold — hits DB
    await isTokenRevoked(USER_ID, TOKEN_IAT, "WAITER");         // warm — cache hit

    expect(dbRaw.tokenRevocation.findUnique).toHaveBeenCalledOnce();
  });

  it("non-ADMIN: re-fetches from DB after 60 s", async () => {
    mockNotRevoked();
    await isTokenRevoked(USER_ID, TOKEN_IAT, "VENUE_OWNER");    // cold

    vi.advanceTimersByTime(REV_CACHE_TTL_MS + 1);
    await isTokenRevoked(USER_ID, TOKEN_IAT, "VENUE_OWNER");    // cache expired

    expect(dbRaw.tokenRevocation.findUnique).toHaveBeenCalledTimes(2);
  });

  it("ADMIN: re-fetches from DB after 5 s (shorter TTL)", async () => {
    mockNotRevoked();
    await isTokenRevoked(USER_ID, TOKEN_IAT, "ADMIN");          // cold

    vi.advanceTimersByTime(REV_CACHE_TTL_ADMIN_MS + 1);
    await isTokenRevoked(USER_ID, TOKEN_IAT, "ADMIN");          // cache expired at 5 s

    expect(dbRaw.tokenRevocation.findUnique).toHaveBeenCalledTimes(2);
  });

  it("ADMIN: still uses cache within 5 s window", async () => {
    mockNotRevoked();
    await isTokenRevoked(USER_ID, TOKEN_IAT, "ADMIN");          // cold

    vi.advanceTimersByTime(REV_CACHE_TTL_ADMIN_MS - 100);
    await isTokenRevoked(USER_ID, TOKEN_IAT, "ADMIN");          // warm

    expect(dbRaw.tokenRevocation.findUnique).toHaveBeenCalledOnce();
  });

  it("ADMIN: cache expires at 5 s even though non-ADMIN entry would still be warm at 60 s", async () => {
    mockNotRevoked();
    // Cache the entry (both roles share the same Map entry)
    await isTokenRevoked(USER_ID, TOKEN_IAT, "WAITER");

    // Advance past ADMIN TTL but within non-ADMIN TTL
    vi.advanceTimersByTime(REV_CACHE_TTL_ADMIN_MS + 1);

    // ADMIN role — should re-fetch (5 s TTL exceeded)
    await isTokenRevoked(USER_ID, TOKEN_IAT, "ADMIN");
    expect(dbRaw.tokenRevocation.findUnique).toHaveBeenCalledTimes(2);
  });
});
