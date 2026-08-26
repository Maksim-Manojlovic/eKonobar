import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth",          () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config",  () => ({ authOptions: {} }));

// DB stays real — unit test mocked dbRaw.$transaction so neither
// sanitaryBook.update nor waiterPassport.upsert/updateMany executed.
// This test also covers the upsert CREATE path (no pre-existing passport)
// and UPDATE path (passport exists), both of which the mock flattened.

import { getServerSession } from "next-auth";
import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { dbRaw } from "@/lib/core/db";
import { PATCH } from "../route";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/verification/sanitary/x", {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function mockAdmin(id: string) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id, role: "ADMIN" },
  } as never);
}

async function createScaffold(opts: { withPassport?: boolean; expiryDate?: Date } = {}) {
  const adminId  = await seedUser({ role: "ADMIN" });
  const waiterId = await seedUser({ role: "WAITER" });

  if (opts.withPassport) {
    await dbRaw.waiterPassport.create({ data: { userId: waiterId } });
  }

  const book = await dbRaw.sanitaryBook.create({
    data: {
      userId:     waiterId,
      fileUrl:    "https://cdn.example.com/sanitary.pdf",
      status:     "PENDING",
      expiryDate: opts.expiryDate ?? null,
    },
  });

  return { adminId, waiterId, bookId: book.id };
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("PATCH /api/verification/sanitary/[id] — integration", () => {

  // ── Guards ─────────────────────────────────────────────────────────────────

  it("nonexistent submission → 404", async () => {
    const { adminId } = await createScaffold();
    mockAdmin(adminId);
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx("nonexistent-id"));
    expect(res.status).toBe(404);
  });

  // ── Approve path ──────────────────────────────────────────────────────────

  it("approve: SanitaryBook → APPROVED + WaiterPassport.sanitaryBookValid=true", async () => {
    const { adminId, waiterId, bookId } = await createScaffold({ withPassport: true });
    mockAdmin(adminId);

    const res = await PATCH(makeReq({ action: "approve" }), makeCtx(bookId));
    expect(res.status).toBe(200);

    // SanitaryBook updated (one side of $transaction)
    const book = await dbRaw.sanitaryBook.findUnique({ where: { id: bookId } });
    expect(book!.status).toBe("APPROVED");
    expect(book!.reviewedBy).toBe(adminId);
    expect(book!.reviewedAt).not.toBeNull();

    // WaiterPassport updated (other side of $transaction)
    const passport = await dbRaw.waiterPassport.findUnique({ where: { userId: waiterId } });
    expect(passport!.sanitaryBookValid).toBe(true);
  });

  it("approve upsert CREATE path: waiterPassport created when none exists", async () => {
    // No passport created in scaffold
    const { adminId, waiterId, bookId } = await createScaffold({ withPassport: false });
    mockAdmin(adminId);

    const before = await dbRaw.waiterPassport.findUnique({ where: { userId: waiterId } });
    expect(before).toBeNull();

    await PATCH(makeReq({ action: "approve" }), makeCtx(bookId));

    // Upsert CREATE path executed — passport created with sanitaryBookValid=true
    const passport = await dbRaw.waiterPassport.findUnique({ where: { userId: waiterId } });
    expect(passport).not.toBeNull();
    expect(passport!.sanitaryBookValid).toBe(true);
  });

  it("approve: sanitaryExpiry set from book.expiryDate", async () => {
    const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
    const { adminId, waiterId, bookId } = await createScaffold({
      withPassport: true,
      expiryDate:   expiry,
    });
    mockAdmin(adminId);

    await PATCH(makeReq({ action: "approve" }), makeCtx(bookId));

    const passport = await dbRaw.waiterPassport.findUnique({ where: { userId: waiterId } });
    expect(passport!.sanitaryExpiry!.toISOString()).toBe(expiry.toISOString());
  });

  it("approve $transaction atomic: both book.status and passport.valid committed together", async () => {
    const { adminId, waiterId, bookId } = await createScaffold({ withPassport: true });
    mockAdmin(adminId);

    await PATCH(makeReq({ action: "approve" }), makeCtx(bookId));

    const [book, passport] = await Promise.all([
      dbRaw.sanitaryBook.findUnique({ where: { id: bookId } }),
      dbRaw.waiterPassport.findUnique({ where: { userId: waiterId } }),
    ]);
    expect(book!.status).toBe("APPROVED");
    expect(passport!.sanitaryBookValid).toBe(true);
  });

  // ── Reject path ───────────────────────────────────────────────────────────

  it("reject: SanitaryBook → REJECTED + passport.sanitaryBookValid=false", async () => {
    const { adminId, waiterId, bookId } = await createScaffold({ withPassport: true });
    // Pre-set sanitaryBookValid to true to verify it gets cleared
    await dbRaw.waiterPassport.update({
      where: { userId: waiterId },
      data:  { sanitaryBookValid: true },
    });
    mockAdmin(adminId);

    const res = await PATCH(makeReq({ action: "reject", rejectReason: "Dokument je nečitak." }), makeCtx(bookId));
    expect(res.status).toBe(200);

    const book = await dbRaw.sanitaryBook.findUnique({ where: { id: bookId } });
    expect(book!.status).toBe("REJECTED");
    expect(book!.rejectReason).toBe("Dokument je nečitak.");
    expect(book!.reviewedBy).toBe(adminId);

    const passport = await dbRaw.waiterPassport.findUnique({ where: { userId: waiterId } });
    expect(passport!.sanitaryBookValid).toBe(false);
    expect(passport!.sanitaryExpiry).toBeNull();
  });

  it("reject with no pre-existing passport: updateMany is a no-op, book still rejected", async () => {
    const { adminId, bookId } = await createScaffold({ withPassport: false });
    mockAdmin(adminId);

    const res = await PATCH(makeReq({ action: "reject" }), makeCtx(bookId));
    expect(res.status).toBe(200);

    const book = await dbRaw.sanitaryBook.findUnique({ where: { id: bookId } });
    expect(book!.status).toBe("REJECTED");
  });

  it("reject: rejectReason null when not provided", async () => {
    const { adminId, bookId } = await createScaffold({ withPassport: true });
    mockAdmin(adminId);

    await PATCH(makeReq({ action: "reject" }), makeCtx(bookId));

    const book = await dbRaw.sanitaryBook.findUnique({ where: { id: bookId } });
    expect(book!.rejectReason).toBeNull();
  });
});
