import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  dbRaw: {
    user:               { findUnique: vi.fn() },
    passwordResetToken: { create: vi.fn() },
  },
}));
vi.mock("@/lib/email",      () => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));

import { dbRaw } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { POST } from "../route";

function makeReq(body: object, ip = "127.0.0.1") {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = dbRaw as any;

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue(true);
    vi.mocked(raw.user.findUnique).mockResolvedValue({ id: "u-1", hashedPassword: "hashed" });
    vi.mocked(raw.passwordResetToken.create).mockResolvedValue(undefined);
    vi.mocked(sendPasswordResetEmail).mockResolvedValue(undefined);
  });

  it("valid email -> 200 { ok: true }", async () => {
    const res = await POST(makeReq({ email: "user@test.com" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("missing email -> 400", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("non-string email -> 400", async () => {
    const res = await POST(makeReq({ email: 123 }));
    expect(res.status).toBe(400);
  });

  it("rate limited -> silent 200 (enumeration prevention)", async () => {
    vi.mocked(rateLimit).mockResolvedValue(false);
    const res = await POST(makeReq({ email: "user@test.com" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("unknown email -> silent 200 (enumeration prevention)", async () => {
    vi.mocked(raw.user.findUnique).mockResolvedValue(null);
    const res = await POST(makeReq({ email: "ghost@test.com" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("OAuth user (no hashedPassword) -> silent 200, no token created", async () => {
    vi.mocked(raw.user.findUnique).mockResolvedValue({ id: "u-1", hashedPassword: null });
    const res = await POST(makeReq({ email: "oauth@test.com" }));
    expect(res.status).toBe(200);
    expect(vi.mocked(raw.passwordResetToken.create)).not.toHaveBeenCalled();
  });

  it("creates reset token for valid user", async () => {
    await POST(makeReq({ email: "user@test.com" }));
    expect(vi.mocked(raw.passwordResetToken.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "u-1" }),
      }),
    );
  });

  it("sends reset email for valid user", async () => {
    await POST(makeReq({ email: "user@test.com" }));
    expect(vi.mocked(sendPasswordResetEmail)).toHaveBeenCalledWith(
      "user@test.com",
      expect.any(String),
    );
  });

  it("email normalized to lowercase", async () => {
    await POST(makeReq({ email: "USER@TEST.COM" }));
    expect(vi.mocked(sendPasswordResetEmail)).toHaveBeenCalledWith(
      "user@test.com",
      expect.any(String),
    );
  });

  it("email send failure still returns 200 (swallowed)", async () => {
    vi.mocked(sendPasswordResetEmail).mockRejectedValue(new Error("SMTP down"));
    const res = await POST(makeReq({ email: "user@test.com" }));
    expect(res.status).toBe(200);
  });

  it("rate limit key uses x-forwarded-for IP", async () => {
    await POST(makeReq({ email: "user@test.com" }, "10.0.0.5"));
    expect(vi.mocked(rateLimit)).toHaveBeenCalledWith("forgot:10.0.0.5", 3, 15 * 60 * 1000);
  });
});
