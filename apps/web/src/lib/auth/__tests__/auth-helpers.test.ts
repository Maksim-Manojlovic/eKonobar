import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/core/db", () => ({
  db: { user: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/core/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("bcryptjs", () => ({ compare: vi.fn() }));

import { db } from "@/lib/core/db";
import { rateLimit } from "@/lib/core/rate-limit";
import { compare } from "bcryptjs";
import {
  checkLoginRateLimit,
  verifyCredentials,
  buildJwtToken,
  buildSessionUser,
  TTL_DEFAULT,
  TTL_REMEMBER,
} from "../helpers";

// ── checkLoginRateLimit ───────────────────────────────────────────────────────

describe("checkLoginRateLimit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves when both IP and email limits pass", async () => {
    vi.mocked(rateLimit).mockResolvedValue(true);
    await expect(checkLoginRateLimit("1.2.3.4", "a@b.com")).resolves.toBeUndefined();
    expect(rateLimit).toHaveBeenCalledTimes(2);
    expect(rateLimit).toHaveBeenCalledWith("login:ip:1.2.3.4", 20, 15 * 60 * 1000);
    expect(rateLimit).toHaveBeenCalledWith("login:email:a@b.com", 5, 15 * 60 * 1000);
  });

  it("throws IP message when IP rate limit exceeded", async () => {
    vi.mocked(rateLimit).mockResolvedValue(false); // first call (IP) fails
    await expect(checkLoginRateLimit("1.2.3.4", "a@b.com"))
      .rejects.toThrow("Previše pokušaja prijave. Sačekaj 15 minuta.");
    expect(rateLimit).toHaveBeenCalledTimes(1); // email check never reached
  });

  it("throws email message when email rate limit exceeded", async () => {
    vi.mocked(rateLimit)
      .mockResolvedValueOnce(true)  // IP passes
      .mockResolvedValueOnce(false); // email fails
    await expect(checkLoginRateLimit("1.2.3.4", "a@b.com"))
      .rejects.toThrow("Previše neuspelih pokušaja prijave. Sačekaj 15 minuta.");
  });
});

// ── verifyCredentials ─────────────────────────────────────────────────────────

const DB_USER = {
  id:               "user-1",
  email:            "test@example.com",
  name:             "Test User",
  role:             "WAITER"            as const,
  verificationTier: "UNVERIFIED"        as const,
  tourCompleted:    false,
  hashedPassword:   "$2a$12$hashed",
};

describe("verifyCredentials", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when user not found", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    expect(await verifyCredentials("x@y.com", "pass")).toBeNull();
  });

  it("returns null when user has no hashedPassword (OAuth-only account)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(
      { ...DB_USER, hashedPassword: null } as never,
    );
    expect(await verifyCredentials(DB_USER.email, "pass")).toBeNull();
  });

  it("returns null when password does not match", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(DB_USER as never);
    vi.mocked(compare).mockResolvedValue(false as never);
    expect(await verifyCredentials(DB_USER.email, "wrongpass")).toBeNull();
  });

  it("returns user fields (without hashedPassword) when credentials valid", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(DB_USER as never);
    vi.mocked(compare).mockResolvedValue(true as never);
    const result = await verifyCredentials(DB_USER.email, "correctpass");
    expect(result).toEqual({
      id:               DB_USER.id,
      email:            DB_USER.email,
      name:             DB_USER.name,
      role:             DB_USER.role,
      verificationTier: DB_USER.verificationTier,
      tourCompleted:    DB_USER.tourCompleted,
    });
    expect(result).not.toHaveProperty("hashedPassword");
  });

  it("queries by the exact email provided", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    await verifyCredentials("exact@email.com", "p");
    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "exact@email.com" } }),
    );
  });

  it("calls compare with the stored hash", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(DB_USER as never);
    vi.mocked(compare).mockResolvedValue(false as never);
    await verifyCredentials(DB_USER.email, "mypassword");
    expect(compare).toHaveBeenCalledWith("mypassword", DB_USER.hashedPassword);
  });
});

// ── buildJwtToken ─────────────────────────────────────────────────────────────

const BASE_USER = {
  id:               "u-1",
  role:             "VENUE_OWNER" as const,
  verificationTier: "GOLD"        as const,
  tourCompleted:    true,
};

describe("buildJwtToken", () => {
  it("credentials without rememberMe → TTL_DEFAULT", () => {
    const now = 1_000_000;
    const fields = buildJwtToken({ ...BASE_USER, rememberMe: false }, false, now);
    expect(fields.sessionExpiry).toBe(now + TTL_DEFAULT);
  });

  it("credentials with rememberMe → TTL_REMEMBER", () => {
    const now = 1_000_000;
    const fields = buildJwtToken({ ...BASE_USER, rememberMe: true }, false, now);
    expect(fields.sessionExpiry).toBe(now + TTL_REMEMBER);
  });

  it("OAuth path → TTL_DEFAULT regardless of rememberMe", () => {
    const now = 1_000_000;
    const fields = buildJwtToken({ ...BASE_USER, rememberMe: true }, true, now);
    expect(fields.sessionExpiry).toBe(now + TTL_DEFAULT);
  });

  it("returns correct id, role, verificationTier, tourCompleted", () => {
    const fields = buildJwtToken(BASE_USER, false, 0);
    expect(fields.id).toBe("u-1");
    expect(fields.role).toBe("VENUE_OWNER");
    expect(fields.verificationTier).toBe("GOLD");
    expect(fields.tourCompleted).toBe(true);
  });

  it("uses provided now param (deterministic — no wall-clock dependency)", () => {
    const fields = buildJwtToken(BASE_USER, false, 500);
    expect(fields.sessionExpiry).toBe(500 + TTL_DEFAULT);
  });

  it("TTL_REMEMBER is 7× TTL_DEFAULT", () => {
    expect(TTL_REMEMBER).toBe(TTL_DEFAULT * 7);
  });
});

// ── buildSessionUser ──────────────────────────────────────────────────────────

describe("buildSessionUser", () => {
  it("maps all token fields to session user shape", () => {
    const token = {
      id:               "u-42",
      role:             "ADMIN"       as const,
      verificationTier: "ID_VERIFIED" as const,
      tourCompleted:    true,
    };
    const result = buildSessionUser(token);
    expect(result).toEqual({
      id:               "u-42",
      role:             "ADMIN",
      verificationTier: "ID_VERIFIED",
      tourCompleted:    true,
    });
  });

  it("tourCompleted false is preserved (not coerced)", () => {
    const token = {
      id: "u-1", role: "WAITER" as const,
      verificationTier: "UNVERIFIED" as const,
      tourCompleted: false,
    };
    expect(buildSessionUser(token).tourCompleted).toBe(false);
  });
});
