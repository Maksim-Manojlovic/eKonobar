import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  dbRaw: {
    passwordResetToken: { findUnique: vi.fn(), update: vi.fn() },
    user:               { update: vi.fn() },
    $transaction:       vi.fn(),
  },
}));
vi.mock("bcryptjs", () => ({ hash: vi.fn().mockResolvedValue("new-hashed-pw") }));

import { dbRaw } from "@/lib/db";
import { POST } from "../route";

function makeReq(body: object) {
  return new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = dbRaw as any;

const VALID_TOKEN = {
  id: "tok-1",
  userId: "u-1",
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  usedAt: null,
};

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(raw.passwordResetToken.findUnique).mockResolvedValue(VALID_TOKEN);
    vi.mocked(raw.$transaction).mockResolvedValue([undefined, undefined]);
    vi.mocked(raw.user.update).mockReturnValue(undefined);
    vi.mocked(raw.passwordResetToken.update).mockReturnValue(undefined);
  });

  it("valid token + password -> 200 { ok: true }", async () => {
    const res = await POST(makeReq({ token: "abc123", password: "newpass123" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("missing token -> 400", async () => {
    const res = await POST(makeReq({ password: "newpass123" }));
    expect(res.status).toBe(400);
  });

  it("missing password -> 400", async () => {
    const res = await POST(makeReq({ token: "abc123" }));
    expect(res.status).toBe(400);
  });

  it("password shorter than 8 chars -> 400", async () => {
    const res = await POST(makeReq({ token: "abc123", password: "short" }));
    expect(res.status).toBe(400);
  });

  it("token not found -> 400", async () => {
    vi.mocked(raw.passwordResetToken.findUnique).mockResolvedValue(null);
    const res = await POST(makeReq({ token: "bad-token", password: "newpass123" }));
    expect(res.status).toBe(400);
  });

  it("token already used -> 400", async () => {
    vi.mocked(raw.passwordResetToken.findUnique).mockResolvedValue({
      ...VALID_TOKEN, usedAt: new Date(),
    });
    const res = await POST(makeReq({ token: "used-token", password: "newpass123" }));
    expect(res.status).toBe(400);
  });

  it("token expired -> 400", async () => {
    vi.mocked(raw.passwordResetToken.findUnique).mockResolvedValue({
      ...VALID_TOKEN, expiresAt: new Date(Date.now() - 1000),
    });
    const res = await POST(makeReq({ token: "expired", password: "newpass123" }));
    expect(res.status).toBe(400);
  });

  it("uses $transaction to update password and mark token used", async () => {
    await POST(makeReq({ token: "abc123", password: "newpass123" }));
    expect(vi.mocked(raw.$transaction)).toHaveBeenCalledTimes(1);
    const txArg = vi.mocked(raw.$transaction).mock.calls[0][0];
    expect(Array.isArray(txArg)).toBe(true);
    expect(txArg).toHaveLength(2);
  });
});
