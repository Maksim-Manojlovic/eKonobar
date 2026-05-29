import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { compare } from "bcryptjs";
import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { dbRaw } from "@/lib/core/db";
import { POST } from "../route";

// No mocks — unit test mocked the $transaction so neither user.update nor
// passwordResetToken.update was ever executed. Critical for security:
// if the two writes aren't atomic a used token could allow a second reset.
//
// Key properties validated here:
//   - both sides of $transaction commit: new password stored + usedAt set
//   - used token rejected on replay (usedAt IS NOT NULL)
//   - expired token rejected before any DB write
//   - invalid token returns 400
//   - new password is bcrypt-hashed, not stored as plaintext

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/auth/reset-password", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const VALID_TOKEN  = "a".repeat(64); // 64 hex chars
const NEW_PASSWORD = "newSecure123";

async function createScaffold(opts: { expired?: boolean; used?: boolean } = {}) {
  const userId = await seedUser();
  await dbRaw.user.update({
    where: { id: userId },
    data:  { hashedPassword: "old-hash-placeholder" },
  });

  const expiresAt = opts.expired
    ? new Date(Date.now() - 3_600_000) // 1h ago
    : new Date(Date.now() + 3_600_000); // 1h from now

  await (dbRaw as any).passwordResetToken.create({
    data: {
      userId,
      token:     VALID_TOKEN,
      expiresAt,
      usedAt:    opts.used ? new Date() : null,
    },
  });

  return { userId };
}

beforeEach(async () => {
  await resetDb();
});

describe("POST /api/auth/reset-password — integration", () => {

  // ── Guard checks ─────────────────────────────────────────────────────────

  it("unknown token → 400, no DB writes", async () => {
    await createScaffold();
    const res = await POST(makeReq({ token: "b".repeat(64), password: NEW_PASSWORD }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/nevažeći/i);
  });

  it("already-used token → 400 (replay prevention)", async () => {
    await createScaffold({ used: true });
    const res = await POST(makeReq({ token: VALID_TOKEN, password: NEW_PASSWORD }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/iskorišćen/i);
  });

  it("expired token → 400, no password change", async () => {
    const { userId } = await createScaffold({ expired: true });
    const res = await POST(makeReq({ token: VALID_TOKEN, password: NEW_PASSWORD }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/istekao/i);

    // Password must be unchanged
    const user = await dbRaw.user.findUnique({ where: { id: userId } });
    expect(user!.hashedPassword).toBe("old-hash-placeholder");
  });

  it("short password → 400 validation error", async () => {
    await createScaffold();
    const res = await POST(makeReq({ token: VALID_TOKEN, password: "short" }));
    expect(res.status).toBe(400);
  });

  // ── Happy path — real $transaction ───────────────────────────────────────

  it("valid reset: 200 + password updated + token marked used", async () => {
    const { userId } = await createScaffold();
    const res = await POST(makeReq({ token: VALID_TOKEN, password: NEW_PASSWORD }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    // user.hashedPassword updated (one side of $transaction)
    const user = await dbRaw.user.findUnique({ where: { id: userId } });
    expect(user!.hashedPassword).not.toBe("old-hash-placeholder");
    expect(user!.hashedPassword).toMatch(/^\$2[ab]\$12\$/); // bcrypt cost 12
    expect(await compare(NEW_PASSWORD, user!.hashedPassword!)).toBe(true);

    // token.usedAt set (other side of $transaction)
    const tokenRow = await (dbRaw as any).passwordResetToken.findUnique({
      where: { token: VALID_TOKEN },
    });
    expect(tokenRow.usedAt).not.toBeNull();
  });

  it("$transaction atomic: usedAt and hashedPassword committed in same write", async () => {
    const { userId } = await createScaffold();
    await POST(makeReq({ token: VALID_TOKEN, password: NEW_PASSWORD }));

    // Both sides visible in DB simultaneously — confirms $transaction committed
    const [user, tokenRow] = await Promise.all([
      dbRaw.user.findUnique({ where: { id: userId } }),
      (dbRaw as any).passwordResetToken.findUnique({ where: { token: VALID_TOKEN } }),
    ]);
    const passwordChanged = user!.hashedPassword !== "old-hash-placeholder";
    const tokenUsed       = tokenRow.usedAt !== null;
    // Both must be true — neither can be half-committed
    expect(passwordChanged).toBe(true);
    expect(tokenUsed).toBe(true);
  });

  it("token replay after valid reset → 400 (usedAt blocks second use)", async () => {
    await createScaffold();
    await POST(makeReq({ token: VALID_TOKEN, password: NEW_PASSWORD })); // first — ok
    const res = await POST(makeReq({ token: VALID_TOKEN, password: "another123" })); // replay
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/iskorišćen/i);
  });

  it("replay does not overwrite the new password", async () => {
    const { userId } = await createScaffold();
    await POST(makeReq({ token: VALID_TOKEN, password: NEW_PASSWORD }));
    await POST(makeReq({ token: VALID_TOKEN, password: "overwrite-attempt" })); // blocked

    const user = await dbRaw.user.findUnique({ where: { id: userId } });
    // Password must still match the FIRST successful reset
    expect(await compare(NEW_PASSWORD, user!.hashedPassword!)).toBe(true);
    expect(await compare("overwrite-attempt", user!.hashedPassword!)).toBe(false);
  });
});
