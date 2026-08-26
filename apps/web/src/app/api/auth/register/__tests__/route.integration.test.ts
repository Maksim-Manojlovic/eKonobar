import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { resetDb } from "@/tests/integration/db-reset";
import { dbRaw } from "@/lib/core/db";
import { POST } from "../route";

// No mocks — validates real DB behaviour the unit test couldn't:
//   - email unique constraint fires on second registration
//   - email is stored lowercase in the actual DB row
//   - password is hashed (bcrypt prefix), not stored as plaintext
//   - case-variant email hits the same unique index (UPPER vs lower)

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/auth/register", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const VALID_WAITER = {
  name:     "Marko Marković",
  email:    "marko@test.local",
  password: "pass1234",
  role:     "WAITER",
};

beforeEach(async () => {
  await resetDb();
});

// ── Happy paths ───────────────────────────────────────────────────────────────

describe("POST /api/auth/register — integration", () => {
  it("WAITER registration: 200 + User row created", async () => {
    const res = await POST(makeReq(VALID_WAITER));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    const user = await dbRaw.user.findUnique({ where: { email: "marko@test.local" } });
    expect(user).not.toBeNull();
    expect(user!.role).toBe("WAITER");
  });

  it("VENUE_OWNER registration: 200 + User row created", async () => {
    const res = await POST(makeReq({ ...VALID_WAITER, email: "owner@test.local", role: "VENUE_OWNER" }));
    expect(res.status).toBe(200);

    const user = await dbRaw.user.findUnique({ where: { email: "owner@test.local" } });
    expect(user).not.toBeNull();
    expect(user!.role).toBe("VENUE_OWNER");
  });

  // ── Real unique constraint ──────────────────────────────────────────────────

  it("duplicate email → 409 (real DB unique index, not app-level guard)", async () => {
    await POST(makeReq(VALID_WAITER));              // first — succeeds
    const res = await POST(makeReq(VALID_WAITER));  // second — must 409
    expect(res.status).toBe(409);
  });

  it("duplicate email — case-insensitive: UPPER variant hits same index", async () => {
    await POST(makeReq(VALID_WAITER));                                           // stores lowercase
    const res = await POST(makeReq({ ...VALID_WAITER, email: "MARKO@TEST.LOCAL" })); // uppercase attempt
    expect(res.status).toBe(409);
  });

  // ── Data integrity ─────────────────────────────────────────────────────────

  it("email stored lowercase regardless of input case", async () => {
    await POST(makeReq({ ...VALID_WAITER, email: "UPPER@TEST.LOCAL" }));
    const user = await dbRaw.user.findUnique({ where: { email: "upper@test.local" } });
    expect(user).not.toBeNull();
    // No row should exist at the original mixed-case email
    const wrong = await dbRaw.user.findUnique({ where: { email: "UPPER@TEST.LOCAL" } });
    expect(wrong).toBeNull();
  });

  it("name stored trimmed", async () => {
    await POST(makeReq({ ...VALID_WAITER, name: "  Marko  " }));
    const user = await dbRaw.user.findUnique({ where: { email: "marko@test.local" } });
    expect(user!.name).toBe("Marko");
  });

  it("password stored as bcrypt hash — not plaintext", async () => {
    await POST(makeReq(VALID_WAITER));
    const user = await dbRaw.user.findUnique({ where: { email: "marko@test.local" } });
    expect(user!.hashedPassword).not.toBeNull();
    expect(user!.hashedPassword).not.toBe("pass1234");
    // bcrypt always starts with $2b$ (cost 12) or $2a$
    expect(user!.hashedPassword).toMatch(/^\$2[ab]\$12\$/);
  });

  it("deletedAt not set on new registration", async () => {
    await POST(makeReq(VALID_WAITER));
    const user = await dbRaw.user.findUnique({ where: { email: "marko@test.local" } });
    expect(user!.deletedAt).toBeNull();
  });

  // ── Validation rejections ──────────────────────────────────────────────────

  it("ADMIN role → 400, no DB row created", async () => {
    const res = await POST(makeReq({ ...VALID_WAITER, role: "ADMIN" }));
    expect(res.status).toBe(400);
    const count = await dbRaw.user.count();
    expect(count).toBe(0);
  });

  it("HEADHUNTER role → 400", async () => {
    const res = await POST(makeReq({ ...VALID_WAITER, role: "HEADHUNTER" }));
    expect(res.status).toBe(400);
  });

  it("short password → 400, no DB row", async () => {
    const res = await POST(makeReq({ ...VALID_WAITER, password: "short" }));
    expect(res.status).toBe(400);
    expect(await dbRaw.user.count()).toBe(0);
  });

  it("invalid email → 400, no DB row", async () => {
    const res = await POST(makeReq({ ...VALID_WAITER, email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(await dbRaw.user.count()).toBe(0);
  });
});
