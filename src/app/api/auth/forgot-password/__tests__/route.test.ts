import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  dbRaw: {
    user: {
      findUnique: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>();
  return {
    ...actual,
    randomBytes: vi.fn(() => ({ toString: () => "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" })),
  };
});

import { dbRaw } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { POST } from "../route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = dbRaw as any;

function makeReq(body: object, ip = "1.2.3.4") {
  return new Request("http://localhost/api/auth/forgot-password", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body:    JSON.stringify(body),
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue(true);
    db.passwordResetToken.create.mockResolvedValue({});
    vi.mocked(sendPasswordResetEmail).mockResolvedValue(undefined);
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is not a string", async () => {
    const res = await POST(makeReq({ email: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns 200 (silent) when rate limit exceeded", async () => {
    vi.mocked(rateLimit).mockResolvedValue(false);
    const res = await POST(makeReq({ email: "test@example.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns 200 (silent) when user does not exist", async () => {
    db.user.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ email: "nobody@example.com" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(db.passwordResetToken.create).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("returns 200 (silent) when user has no password (OAuth-only)", async () => {
    db.user.findUnique.mockResolvedValue({ id: "user-1", hashedPassword: null });
    const res = await POST(makeReq({ email: "oauth@example.com" }));
    expect(res.status).toBe(200);
    expect(db.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("creates token and sends email for valid user", async () => {
    db.user.findUnique.mockResolvedValue({ id: "user-1", hashedPassword: "$2b$12$hash" });
    const res = await POST(makeReq({ email: "user@example.com" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(db.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          token:  expect.any(String),
          expiresAt: expect.any(Date),
        }),
      }),
    );
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      "user@example.com",
      expect.any(String),
    );
  });

  it("normalizes email to lowercase", async () => {
    db.user.findUnique.mockResolvedValue({ id: "user-1", hashedPassword: "$2b$12$hash" });
    await POST(makeReq({ email: "User@EXAMPLE.COM" }));
    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "user@example.com" } }),
    );
  });

  it("returns 200 even when sendMail throws", async () => {
    db.user.findUnique.mockResolvedValue({ id: "user-1", hashedPassword: "$2b$12$hash" });
    vi.mocked(sendPasswordResetEmail).mockRejectedValue(new Error("SMTP down"));
    const res = await POST(makeReq({ email: "user@example.com" }));
    expect(res.status).toBe(200);
  });
});
