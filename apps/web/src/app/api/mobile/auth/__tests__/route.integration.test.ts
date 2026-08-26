import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { hash } from "bcryptjs";

// getServerSession is mocked to return null for every call, so nothing here can
// pass by accident through the cookie path — every 200 below is the bearer path.
vi.mock("next-auth",         () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
// Redis is pinned off: revocation and the waiter-search cache both read through it,
// and a dev machine with REDIS_URL set would otherwise leak state between files.
vi.mock("@/lib/core/redis",  () => ({ redis: null }));

import { getServerSession } from "next-auth";
import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { dbRaw } from "@/lib/core/db";
import { hashRefreshToken } from "@/lib/auth/mobile-tokens";

import { POST as login }   from "../login/route";
import { POST as refresh } from "../refresh/route";
import { POST as logout }  from "../logout/route";
import { GET as me }       from "../../me/route";
import { GET as waiters }  from "@/app/api/waiters/route";
import { GET as passport } from "@/app/api/passport/route";

const CTX = { params: Promise.resolve({}) };

const PASSWORD = "correct-horse-battery";
const DEVICE   = { deviceId: "device-abc", deviceName: "iPhone 13", platform: "ios" };

function postReq(path: string, body: unknown) {
  return new NextRequest(`http://localhost/api/mobile/${path}`, {
    method:  "POST",
    headers: { "content-type": "application/json" },
    body:    JSON.stringify(body),
  });
}

function getReq(path: string, bearer?: string) {
  return new NextRequest(`http://localhost${path}`, {
    method:  "GET",
    headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
  });
}

async function seedLoginUser(role: "WAITER" | "VENUE_OWNER" = "WAITER") {
  const email = `mobile-${crypto.randomUUID()}@integration.local`;
  const id    = await seedUser({ email, role, hashedPassword: await hash(PASSWORD, 4) });
  return { id, email };
}

async function signIn(email: string) {
  const res  = await login(postReq("auth/login", { email, password: PASSWORD, ...DEVICE }));
  const body = await res.json();
  return { status: res.status, ...body };
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue(null);
});

describe("POST /api/mobile/auth/login", () => {
  it("returns an access token, a refresh token and the user", async () => {
    const { email, id } = await seedLoginUser();
    const out = await signIn(email);

    expect(out.status).toBe(200);
    expect(typeof out.accessToken).toBe("string");
    expect(typeof out.refreshToken).toBe("string");
    expect(out.user).toMatchObject({ id, email, role: "WAITER" });
  });

  it("rejects a wrong password with 401", async () => {
    const { email } = await seedLoginUser();

    const res = await login(postReq("auth/login", { email, password: "wrong", ...DEVICE }));
    expect(res.status).toBe(401);
  });

  it("gives an unknown email the same 401 — no account enumeration", async () => {
    const res = await login(
      postReq("auth/login", { email: "nobody@integration.local", password: PASSWORD, ...DEVICE }),
    );
    expect(res.status).toBe(401);
  });

  it("stores only the refresh token's hash", async () => {
    const { email } = await seedLoginUser();
    const out = await signIn(email);

    const rows = await dbRaw.mobileRefreshToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashRefreshToken(out.refreshToken));
    expect(rows[0].tokenHash).not.toBe(out.refreshToken);
  });

  it("rejects a malformed body with 400", async () => {
    const res = await login(postReq("auth/login", { email: "not-an-email", password: "x" }));
    expect(res.status).toBe(400);
  });
});

describe("bearer tokens on existing routes", () => {
  it("GET /api/mobile/me returns the caller", async () => {
    const { email, id } = await seedLoginUser();
    const { accessToken } = await signIn(email);

    const res  = await me(getReq("/api/mobile/me", accessToken), CTX);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.user).toMatchObject({ id, role: "WAITER" });
  });

  it("401s a request with no Authorization header", async () => {
    const res = await me(getReq("/api/mobile/me"), CTX);
    expect(res.status).toBe(401);
  });

  it("401s a garbage bearer token", async () => {
    const res = await me(getReq("/api/mobile/me", "not-a-real-token"), CTX);
    expect(res.status).toBe(401);
  });

  it("serves an untouched WAITER-guarded route (GET /api/passport)", async () => {
    const { email } = await seedLoginUser("WAITER");
    const { accessToken } = await signIn(email);

    const res = await passport(getReq("/api/passport", accessToken), CTX);
    expect(res.status).toBe(200);
  });

  it("403s that same waiter on a VENUE_OWNER-guarded route (GET /api/waiters)", async () => {
    const { email } = await seedLoginUser("WAITER");
    const { accessToken } = await signIn(email);

    const res = await waiters(getReq("/api/waiters", accessToken), CTX);
    expect(res.status).toBe(403);
  });

  it("200s a VENUE_OWNER on that route — the role in the token is honoured", async () => {
    const { email } = await seedLoginUser("VENUE_OWNER");
    const { accessToken } = await signIn(email);

    const res = await waiters(getReq("/api/waiters", accessToken), CTX);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/mobile/auth/refresh", () => {
  it("issues a new pair and rotates the refresh token", async () => {
    const { email } = await seedLoginUser();
    const first = await signIn(email);

    const res  = await refresh(postReq("auth/refresh", { refreshToken: first.refreshToken }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.refreshToken).not.toBe(first.refreshToken);
    expect(typeof body.accessToken).toBe("string");
  });

  it("the rotated-away token stops working", async () => {
    const { email } = await seedLoginUser();
    const first = await signIn(email);
    await refresh(postReq("auth/refresh", { refreshToken: first.refreshToken }));

    const replay = await refresh(postReq("auth/refresh", { refreshToken: first.refreshToken }));
    expect(replay.status).toBe(401);
  });

  it("reuse revokes the whole device chain, so the live successor dies too", async () => {
    const { email } = await seedLoginUser();
    const first  = await signIn(email);
    const second = await (await refresh(
      postReq("auth/refresh", { refreshToken: first.refreshToken }),
    )).json();

    // Replaying the consumed token is the theft signal.
    await refresh(postReq("auth/refresh", { refreshToken: first.refreshToken }));

    const afterChainKill = await refresh(postReq("auth/refresh", { refreshToken: second.refreshToken }));
    expect(afterChainKill.status).toBe(401);

    const live = await dbRaw.mobileRefreshToken.count({ where: { revokedAt: null } });
    expect(live).toBe(0);
  });

  it("401s an unknown token", async () => {
    const res = await refresh(postReq("auth/refresh", { refreshToken: "never-issued" }));
    expect(res.status).toBe(401);
  });

  it("401s once the account is soft-deleted", async () => {
    const { email, id } = await seedLoginUser();
    const first = await signIn(email);
    await dbRaw.user.update({ where: { id }, data: { deletedAt: new Date() } });

    const res = await refresh(postReq("auth/refresh", { refreshToken: first.refreshToken }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/mobile/auth/logout", () => {
  it("revokes the token and returns 204", async () => {
    const { email } = await seedLoginUser();
    const { refreshToken } = await signIn(email);

    const res = await logout(postReq("auth/logout", { refreshToken }));
    expect(res.status).toBe(204);

    const after = await refresh(postReq("auth/refresh", { refreshToken }));
    expect(after.status).toBe(401);
  });

  it("is idempotent for an unknown token", async () => {
    const res = await logout(postReq("auth/logout", { refreshToken: "never-issued" }));
    expect(res.status).toBe(204);
  });
});
