import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";

// bearer.ts pulls helpers.ts, which imports the Prisma client and the rate limiter.
// Neither is exercised here — buildSessionUser is pure — so stub the modules out.
vi.mock("@/lib/core/db",    () => ({ db: {}, dbRaw: {} }));
vi.mock("@/lib/core/redis", () => ({ redis: null }));
vi.mock("@/lib/auth/revocation", () => ({ isTokenRevoked: vi.fn() }));

import { isTokenRevoked } from "@/lib/auth/revocation";
import { readBearerToken, getBearerSession } from "../bearer";

const SECRET = "bearer-unit-test-secret";

function req(header?: string): NextRequest {
  return new NextRequest("http://localhost/api/anything", {
    method:  "GET",
    headers: header ? { authorization: header } : {},
  });
}

async function signToken(overrides: Record<string, unknown> = {}, maxAge = 900) {
  return encode({
    secret: SECRET,
    maxAge,
    token: {
      id:               "user-1",
      role:             "WAITER",
      verificationTier: "GOLD",
      tourCompleted:    true,
      sessionExpiry:    Math.floor(Date.now() / 1000) + 900,
      email:            "marko@example.rs",
      name:             "Marko",
      ...overrides,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXTAUTH_SECRET = SECRET;
  vi.mocked(isTokenRevoked).mockResolvedValue(false);
});

describe("readBearerToken", () => {
  it("extracts the token after the Bearer prefix", () => {
    expect(readBearerToken("Bearer abc.def")).toBe("abc.def");
  });

  it("returns null for a missing header", () => {
    expect(readBearerToken(null)).toBeNull();
  });

  it("returns null for a non-Bearer scheme", () => {
    expect(readBearerToken("Basic abc")).toBeNull();
  });

  it("returns null for Bearer with no token", () => {
    expect(readBearerToken("Bearer    ")).toBeNull();
  });

  it("is case-sensitive on the scheme, matching the RFC-6750 form we emit", () => {
    expect(readBearerToken("bearer abc")).toBeNull();
  });
});

describe("getBearerSession", () => {
  it("resolves a full Session from a valid token", async () => {
    const session = await getBearerSession(req(`Bearer ${await signToken()}`));

    expect(session).not.toBeNull();
    expect(session!.user).toMatchObject({
      id:               "user-1",
      role:             "WAITER",
      verificationTier: "GOLD",
      tourCompleted:    true,
      email:            "marko@example.rs",
      name:             "Marko",
    });
  });

  it("returns null when no Authorization header is present", async () => {
    expect(await getBearerSession(req())).toBeNull();
  });

  it("returns null for a malformed token", async () => {
    expect(await getBearerSession(req("Bearer not-a-jwt"))).toBeNull();
  });

  it("returns null for a token signed with a different secret", async () => {
    const foreign = await encode({
      secret: "some-other-secret",
      token: {
        id:               "user-1",
        role:             "ADMIN",
        verificationTier: "ID_VERIFIED",
        tourCompleted:    true,
        sessionExpiry:    Math.floor(Date.now() / 1000) + 900,
      },
    });
    expect(await getBearerSession(req(`Bearer ${foreign}`))).toBeNull();
  });

  it("returns null for an expired token", async () => {
    // Negative maxAge puts exp a minute in the past. (maxAge 0 is not enough —
    // exp lands on the current second and decode still accepts it.)
    const expired = await signToken({}, -60);
    expect(await getBearerSession(req(`Bearer ${expired}`))).toBeNull();
  });

  it("returns null when the token has been revoked", async () => {
    vi.mocked(isTokenRevoked).mockResolvedValue(true);
    expect(await getBearerSession(req(`Bearer ${await signToken()}`))).toBeNull();
  });

  it("passes the role to isTokenRevoked so ADMIN keeps its shorter cache TTL", async () => {
    await getBearerSession(req(`Bearer ${await signToken({ role: "ADMIN" })}`));

    expect(isTokenRevoked).toHaveBeenCalledWith("user-1", expect.any(Number), "ADMIN");
  });

  it("returns null when NEXTAUTH_SECRET is unset rather than trusting the token", async () => {
    const token = await signToken();
    delete process.env.NEXTAUTH_SECRET;

    expect(await getBearerSession(req(`Bearer ${token}`))).toBeNull();

    process.env.NEXTAUTH_SECRET = SECRET;
  });
});
