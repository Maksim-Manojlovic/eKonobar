import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  dbRaw: {
    sanitaryBook:   { findUnique: vi.fn() },
    waiterPassport: { upsert: vi.fn(), updateMany: vi.fn() },
    $transaction:   vi.fn(),
  },
}));
vi.mock("@/lib/core/audit", () => ({ logAudit: vi.fn() }));

import { getServerSession } from "next-auth";
import { dbRaw } from "@/lib/core/db";
import { PATCH } from "../route";

const ADMIN_ID = "admin-1";
const BOOK_ID  = "sb-1";

const BASE_BOOK = {
  id: BOOK_ID,
  userId: "waiter-1",
  status: "PENDING",
  fileUrl: "https://cdn.test/doc.pdf",
  expiryDate: null,
};

function makeCtx(id = BOOK_ID) {
  return { params: Promise.resolve({ id }) };
}

function makeReq(body: object) {
  return new NextRequest(`http://localhost/api/verification/sanitary/${BOOK_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(role = "ADMIN", id = ADMIN_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

// Simulate interactive transaction: call the callback with a mock tx
function mockTx() {
  const tx = {
    sanitaryBook:   { update: vi.fn().mockResolvedValue({ ...BASE_BOOK, status: "APPROVED" }) },
    waiterPassport: { upsert: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({}) },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(dbRaw.$transaction).mockImplementation(async (fn: any) => fn(tx));
  return tx;
}

describe("PATCH /api/verification/sanitary/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(dbRaw.sanitaryBook.findUnique).mockResolvedValue(BASE_BOOK as never);
    mockTx();
  });

  it("ADMIN approves submission → 200", async () => {
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(200);
  });

  it("ADMIN rejects submission → 200", async () => {
    const tx = mockTx();
    tx.sanitaryBook.update.mockResolvedValue({ ...BASE_BOOK, status: "REJECTED" });
    const res = await PATCH(makeReq({ action: "reject", rejectReason: "Isteklo" }), makeCtx());
    expect(res.status).toBe(200);
  });

  it("approve sets sanitaryBookValid=true on WaiterPassport", async () => {
    const tx = mockTx();
    await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(tx.waiterPassport.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ sanitaryBookValid: true }),
      }),
    );
  });

  it("reject sets sanitaryBookValid=false on WaiterPassport", async () => {
    const tx = mockTx();
    tx.sanitaryBook.update.mockResolvedValue({ ...BASE_BOOK, status: "REJECTED" });
    await PATCH(makeReq({ action: "reject" }), makeCtx());
    expect(tx.waiterPassport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sanitaryBookValid: false, sanitaryExpiry: null }),
      }),
    );
  });

  it("non-ADMIN → 403", async () => {
    mockSession("WAITER", "w-1");
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("invalid action → 400", async () => {
    const res = await PATCH(makeReq({ action: "publish" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("book not found → 404", async () => {
    vi.mocked(dbRaw.sanitaryBook.findUnique).mockResolvedValue(null);
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(404);
  });
});
