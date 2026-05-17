import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  dbRaw: {
    passwordResetToken: {
      findUnique: vi.fn(),
      update:     vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("$2b$12$hashed"),
}));

import { dbRaw } from "@/lib/db";
import { hash }  from "bcryptjs";
import { POST }  from "../route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = dbRaw as any;

function makeReq(body: object) {
  return new Request("http://localhost/api/auth/reset-password", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const VALID_TOKEN_RECORD = {
  id:        "tok-1",
  userId:    "user-1",
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  usedAt:    null,
};

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
    db.user.update.mockResolvedValue({});
    db.passwordResetToken.update.mockResolvedValue({});
  });

  // ── Input validation ────────────────────────────────────────────────────────

  it("returns 400 when token is missing", async () => {
    const res = await POST(makeReq({ password: "newpassword1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    db.passwordResetToken.findUnique.mockResolvedValue(VALID_TOKEN_RECORD);
    const res = await POST(makeReq({ token: "abc" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is shorter than 8 chars", async () => {
    db.passwordResetToken.findUnique.mockResolvedValue(VALID_TOKEN_RECORD);
    const res = await POST(makeReq({ token: "abc", password: "short" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/8/);
  });

  // ── Token validation ────────────────────────────────────────────────────────

  it("returns 400 when token does not exist", async () => {
    db.passwordResetToken.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ token: "bad-token", password: "validpass1" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/nevažeći/i);
  });

  it("returns 400 when token is already used", async () => {
    db.passwordResetToken.findUnique.mockResolvedValue({
      ...VALID_TOKEN_RECORD,
      usedAt: new Date(Date.now() - 1000),
    });
    const res = await POST(makeReq({ token: "used-token", password: "validpass1" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/iskorišćen/i);
  });

  it("returns 400 when token is expired", async () => {
    db.passwordResetToken.findUnique.mockResolvedValue({
      ...VALID_TOKEN_RECORD,
      expiresAt: new Date(Date.now() - 1000),
    });
    const res = await POST(makeReq({ token: "expired-token", password: "validpass1" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/istekao/i);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it("hashes password with cost 12 and updates user", async () => {
    db.passwordResetToken.findUnique.mockResolvedValue(VALID_TOKEN_RECORD);
    const res = await POST(makeReq({ token: "valid-token", password: "newpassword1" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(hash).toHaveBeenCalledWith("newpassword1", 12);
  });

  it("marks token as used in the same transaction", async () => {
    db.passwordResetToken.findUnique.mockResolvedValue(VALID_TOKEN_RECORD);
    await POST(makeReq({ token: "valid-token", password: "newpassword1" }));
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data:  { hashedPassword: "$2b$12$hashed" },
      }),
    );
    expect(db.passwordResetToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tok-1" },
        data:  { usedAt: expect.any(Date) },
      }),
    );
  });
});
