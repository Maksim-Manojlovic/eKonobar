import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/core/db", () => ({
  dbRaw: {
    account: { findUnique: vi.fn() },
    user:    { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/core/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/auth/oauth-verify", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/oauth-verify")>(
    "@/lib/auth/oauth-verify",
  );
  return { ...actual, verifyOAuthToken: vi.fn() };
});
vi.mock("@/lib/auth/mobile-tokens", () => ({
  ACCESS_TTL_SECONDS: 900,
  issueAccessToken:   vi.fn(),
  issueRefreshToken:  vi.fn(),
}));
vi.mock("@/lib/core/logger", () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { dbRaw } from "@/lib/core/db";
import { rateLimit } from "@/lib/core/rate-limit";
import { OAuthVerificationError, verifyOAuthToken } from "@/lib/auth/oauth-verify";
import { issueAccessToken, issueRefreshToken } from "@/lib/auth/mobile-tokens";
import { postReq } from "@/tests/unit/route-harness";
import { POST } from "../route";

const BODY = {
  provider: "google" as const,
  token:    "id-token",
  deviceId: "device-1",
  platform: "ios" as const,
};

const IDENTITY = {
  provider:          "google" as const,
  providerAccountId: "google-sub-1",
  email:             "novi@test.com",
  name:              "Novi Konobar",
  image:             null,
  emailVerified:     true,
};

const USER = {
  id: "user-1", email: "novi@test.com", name: "Novi Konobar",
  role: "WAITER", verificationTier: "UNVERIFIED", tourCompleted: false,
  deletedAt: null,
};

const req = (body: object = BODY) => postReq(body, "http://localhost/api/mobile/auth/oauth");

describe("POST /api/mobile/auth/oauth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue(true);
    vi.mocked(verifyOAuthToken).mockResolvedValue(IDENTITY);
    vi.mocked(dbRaw.account.findUnique).mockResolvedValue(null as never);
    vi.mocked(dbRaw.user.findUnique).mockResolvedValue(null as never);
    vi.mocked(dbRaw.user.create).mockResolvedValue(USER as never);
    vi.mocked(issueAccessToken).mockResolvedValue("access" as never);
    vi.mocked(issueRefreshToken).mockResolvedValue({
      token: "refresh", expiresAt: new Date("2026-12-01"),
    } as never);
  });

  it("a rejected provider token never reaches the database", async () => {
    vi.mocked(verifyOAuthToken).mockRejectedValue(
      new OAuthVerificationError("Google prijava nije uspela."),
    );

    const res = await POST(req());

    expect(res.status).toBe(401);
    // The whole point: nothing is created or looked up on an unverified claim.
    expect(vi.mocked(dbRaw.user.create)).not.toHaveBeenCalled();
    expect(vi.mocked(dbRaw.account.findUnique)).not.toHaveBeenCalled();
  });

  it("rate limited → 429 before any provider call", async () => {
    vi.mocked(rateLimit).mockResolvedValue(false);

    const res = await POST(req());

    expect(res.status).toBe(429);
    expect(vi.mocked(verifyOAuthToken)).not.toHaveBeenCalled();
  });

  it("a returning user signs in through their existing account row", async () => {
    vi.mocked(dbRaw.account.findUnique).mockResolvedValue({ user: USER } as never);

    const res = await POST(req());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.user.id).toBe("user-1");
    expect(json.accessToken).toBe("access");
    expect(vi.mocked(dbRaw.user.create)).not.toHaveBeenCalled();
  });

  it("an existing email with no linked account is refused, not linked", async () => {
    vi.mocked(dbRaw.user.findUnique).mockResolvedValue({
      id: "victim-1", hashedPassword: "$2b$12$hash", accounts: [],
    } as never);

    const res = await POST(req());
    const json = await res.json();

    // Linking on a matching email would let anyone who can create a Google
    // account bearing a victim's address sign in as them, with no password.
    expect(res.status).toBe(409);
    expect(json.error).toMatch(/lozinkom/);
    expect(vi.mocked(dbRaw.user.create)).not.toHaveBeenCalled();
    expect(vi.mocked(issueAccessToken)).not.toHaveBeenCalled();
  });

  it("names the provider the existing account actually uses", async () => {
    vi.mocked(dbRaw.user.findUnique).mockResolvedValue({
      id: "u", hashedPassword: null, accounts: [{ provider: "facebook" }],
    } as never);

    const json = await (await POST(req())).json();
    expect(json.error).toMatch(/Facebook/);
  });

  it("a soft-deleted user cannot sign in", async () => {
    vi.mocked(dbRaw.account.findUnique).mockResolvedValue({
      user: { ...USER, deletedAt: new Date() },
    } as never);

    const res = await POST(req());

    expect(res.status).toBe(403);
    expect(vi.mocked(issueAccessToken)).not.toHaveBeenCalled();
  });

  it("a new user is created as WAITER", async () => {
    await POST(req());

    const call = vi.mocked(dbRaw.user.create).mock.calls[0][0] as {
      data: { role: string; emailVerified: Date | null };
    };
    // Venue-owner accounts are admin-created only: a Google sign-in proves
    // nothing about owning a venue.
    expect(call.data.role).toBe("WAITER");
    expect(call.data.emailVerified).toBeInstanceOf(Date);
  });

  it("an unverified provider email is not stamped as verified", async () => {
    vi.mocked(verifyOAuthToken).mockResolvedValue({ ...IDENTITY, emailVerified: false });

    await POST(req());

    const call = vi.mocked(dbRaw.user.create).mock.calls[0][0] as {
      data: { emailVerified: Date | null };
    };
    expect(call.data.emailVerified).toBeNull();
  });

  it("a provider that withholds the email is refused", async () => {
    vi.mocked(verifyOAuthToken).mockResolvedValue({ ...IDENTITY, email: null });

    const res = await POST(req());

    expect(res.status).toBe(400);
    expect(vi.mocked(dbRaw.user.create)).not.toHaveBeenCalled();
  });

  it("rejects an unknown provider at the schema", async () => {
    const res = await POST(req({ ...BODY, provider: "twitter" }));
    expect(res.status).toBe(400);
    expect(vi.mocked(verifyOAuthToken)).not.toHaveBeenCalled();
  });
});
