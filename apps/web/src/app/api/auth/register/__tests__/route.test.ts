import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/core/db", () => ({
  dbRaw: {
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("bcryptjs", () => ({ hash: vi.fn().mockResolvedValue("hashed-pw") }));

import { dbRaw } from "@/lib/core/db";
import { POST } from "../route";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { name: "Marko", email: "marko@test.com", password: "pass1234", role: "WAITER" };

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbRaw.user.findUnique).mockResolvedValue(null);
    vi.mocked(dbRaw.user.create).mockResolvedValue({ id: "u-1" } as never);
  });

  it("valid WAITER registration → 200", async () => {
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("valid VENUE_OWNER registration → 200", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, role: "VENUE_OWNER" }));
    expect(res.status).toBe(200);
  });

  it("missing name → 400", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, name: "" }));
    expect(res.status).toBe(400);
  });

  it("missing email → 400", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, email: "" }));
    expect(res.status).toBe(400);
  });

  it("missing password → 400", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, password: undefined }));
    expect(res.status).toBe(400);
  });

  it("short password → 400", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, password: "short" }));
    expect(res.status).toBe(400);
  });

  it("invalid role → 400", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, role: "ADMIN" }));
    expect(res.status).toBe(400);
  });

  it("HEADHUNTER role rejected → 400", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, role: "HEADHUNTER" }));
    expect(res.status).toBe(400);
  });

  it("duplicate email → 409", async () => {
    vi.mocked(dbRaw.user.findUnique).mockResolvedValue({ id: "existing" } as never);
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(409);
  });

  it("email stored lowercase", async () => {
    await POST(makeReq({ ...VALID_BODY, email: "MARKO@TEST.COM" }));
    expect(vi.mocked(dbRaw.user.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "marko@test.com" }),
      }),
    );
  });

  it("name stored trimmed", async () => {
    await POST(makeReq({ ...VALID_BODY, name: "  Marko  " }));
    expect(vi.mocked(dbRaw.user.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Marko" }),
      }),
    );
  });

  it("password stored as hash not plaintext", async () => {
    await POST(makeReq(VALID_BODY));
    expect(vi.mocked(dbRaw.user.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hashedPassword: "hashed-pw" }),
      }),
    );
  });
});
