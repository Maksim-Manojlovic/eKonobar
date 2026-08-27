import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth",         () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/redis",  () => ({ redis: null }));
// Only the outbound mail is stubbed; the user row, the reset token and the
// audit entry are all written for real.
vi.mock("@/lib/integrations/email", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendNotificationEmail:  vi.fn().mockResolvedValue(undefined),
  sendDemoLeadEmail:      vi.fn().mockResolvedValue(undefined),
}));

import { getServerSession } from "next-auth";
import { compare } from "bcryptjs";
import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { dbRaw } from "@/lib/core/db";
import { sendPasswordResetEmail } from "@/lib/integrations/email";
import { POST } from "../route";

const CTX = { params: Promise.resolve({}) };

function req(body: unknown) {
  return new NextRequest("http://localhost/api/admin/users", {
    method:  "POST",
    headers: { "content-type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const OWNER = { name: "Petar Vlasnik", email: "Novi.Vlasnik@Example.RS", role: "VENUE_OWNER" };

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

async function asAdmin() {
  const id = await seedUser({ role: "ADMIN" });
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role: "ADMIN" } } as never);
  return id;
}

describe("POST /api/admin/users", () => {
  it("creates the account and returns a single-use set-password link", async () => {
    await asAdmin();

    const res  = await POST(req(OWNER), CTX);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.user).toMatchObject({ email: "novi.vlasnik@example.rs", role: "VENUE_OWNER" });
    expect(body.setPasswordUrl).toContain("/reset-password?token=");

    const token = await dbRaw.passwordResetToken.findFirst({ where: { userId: body.user.id } });
    expect(token).not.toBeNull();
    expect(body.setPasswordUrl).toContain(token!.token);
    expect(token!.usedAt).toBeNull();
  });

  it("lowercases the email so it cannot be duplicated by casing", async () => {
    await asAdmin();
    const body = await (await POST(req(OWNER), CTX)).json();
    expect(body.user.email).toBe("novi.vlasnik@example.rs");
  });

  it("sets a hashedPassword, or the reset flow would refuse the account", async () => {
    await asAdmin();
    const body = await (await POST(req(OWNER), CTX)).json();

    const row = await dbRaw.user.findUnique({
      where: { id: body.user.id }, select: { hashedPassword: true },
    });
    // forgot-password bails on !hashedPassword — an account created without one
    // could never set a password by any route.
    expect(row!.hashedPassword).toBeTruthy();
  });

  it("never returns or logs the placeholder password", async () => {
    await asAdmin();
    const res  = await POST(req(OWNER), CTX);
    const text = JSON.stringify(await res.json());

    expect(text).not.toMatch(/password"\s*:\s*"/i);
    expect(text).not.toContain("hashedPassword");
  });

  it("the placeholder password is not a guessable constant", async () => {
    await asAdmin();
    const a = await (await POST(req(OWNER), CTX)).json();
    const b = await (await POST(req({ ...OWNER, email: "drugi@example.rs" }), CTX)).json();

    const rows = await dbRaw.user.findMany({
      where: { id: { in: [a.user.id, b.user.id] } },
      select: { hashedPassword: true },
    });
    expect(rows[0].hashedPassword).not.toBe(rows[1].hashedPassword);
    // And it is certainly not something obvious.
    for (const r of rows) {
      expect(await compare("password", r.hashedPassword!)).toBe(false);
      expect(await compare("", r.hashedPassword!)).toBe(false);
    }
  });

  it("sends the set-password email and reports whether it went", async () => {
    await asAdmin();
    const body = await (await POST(req(OWNER), CTX)).json();

    expect(sendPasswordResetEmail).toHaveBeenCalledWith("novi.vlasnik@example.rs", expect.any(String));
    expect(body.emailSent).toBe(true);
  });

  it("still creates the account when the email fails", async () => {
    await asAdmin();
    vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(new Error("smtp down"));

    const res  = await POST(req(OWNER), CTX);
    const body = await res.json();

    // The admin is mid-call and has the link in the response; a dead SMTP box
    // must not cost them the account.
    expect(res.status).toBe(201);
    expect(body.emailSent).toBe(false);
    expect(body.setPasswordUrl).toContain("token=");
  });

  it("409s a duplicate email instead of creating a second account", async () => {
    await asAdmin();
    await POST(req(OWNER), CTX);

    const res = await POST(req(OWNER), CTX);
    expect(res.status).toBe(409);
    expect(await dbRaw.user.count({ where: { email: "novi.vlasnik@example.rs" } })).toBe(1);
  });

  it("refuses to mint another ADMIN", async () => {
    await asAdmin();
    const res = await POST(req({ ...OWNER, role: "ADMIN" }), CTX);
    expect(res.status).toBe(400);
  });

  it("writes an audit row naming the admin who did it", async () => {
    const adminId = await asAdmin();
    const body = await (await POST(req(OWNER), CTX)).json();

    // logAudit is fire-and-forget.
    await new Promise(r => setTimeout(r, 20));

    const entry = await dbRaw.auditLog.findFirst({ where: { targetId: body.user.id } });
    expect(entry).toMatchObject({ actorId: adminId, action: "ADMIN_USER_CREATE", targetType: "User" });
  });

  it("403s a non-admin", async () => {
    const id = await seedUser({ role: "VENUE_OWNER" });
    vi.mocked(getServerSession).mockResolvedValue({ user: { id, role: "VENUE_OWNER" } } as never);

    const res = await POST(req(OWNER), CTX);
    expect(res.status).toBe(403);
  });
});
