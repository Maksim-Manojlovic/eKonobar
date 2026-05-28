import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock only external crypto/notification concerns — DB stays real.
// This test validates what the unit test mock couldn't:
//   - Real $transaction commits both PassportPayment + WaiterPassport atomically
//   - Real updateMany WHERE callbackReceivedAt IS NULL serializes concurrent callbacks
//   - Idempotency fast-path (status === "SUCCESS") actually reads from DB
vi.mock("@/lib/integrations/monri", () => ({
  verifyCallback:   vi.fn(),
  callbackApproved: vi.fn(),
}));
vi.mock("@/lib/notifications/side-effects", () => ({ fireSideEffects: vi.fn() }));

import { verifyCallback, callbackApproved } from "@/lib/integrations/monri";
import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { dbRaw } from "@/lib/core/db";
import { POST } from "../route";

const ORDER = "EK-integration-cb-001";

const APPROVED_PAYLOAD = {
  order_number:  ORDER,
  approval_code: "APPROV123",
  pan_token:     "tok_test_integration",
  digest:        "valid",
  response_code: "0000",
  status:        "approved",
};

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/payments/monri/callback", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

describe("POST /api/payments/monri/callback — integration", () => {
  let userId: string;

  beforeEach(async () => {
    await resetDb();
    vi.mocked(verifyCallback).mockReturnValue(true);
    vi.mocked(callbackApproved).mockReturnValue(true);

    userId = await seedUser({ role: "WAITER" });
    await dbRaw.waiterPassport.create({ data: { userId } });
    await dbRaw.passportPayment.create({
      data: {
        userId,
        orderNumber: ORDER,
        tier:        "PRO",
        amountRsd:   29000,
        status:      "PENDING",
      },
    });
  });

  // ── Guard checks ─────────────────────────────────────────────────────────────

  it("invalid digest → 400; DB row stays PENDING", async () => {
    vi.mocked(verifyCallback).mockReturnValue(false);
    const res = await POST(makeReq(APPROVED_PAYLOAD));
    expect(res.status).toBe(400);

    const payment = await dbRaw.passportPayment.findUnique({ where: { orderNumber: ORDER } });
    expect(payment!.status).toBe("PENDING");
  });

  it("unknown order number → 404", async () => {
    const res = await POST(makeReq({ ...APPROVED_PAYLOAD, order_number: "EK-ghost-999" }));
    expect(res.status).toBe(404);
  });

  // ── Happy path — real $transaction ───────────────────────────────────────────

  it("approved: PassportPayment → SUCCESS, WaiterPassport → PRO (same transaction)", async () => {
    const res = await POST(makeReq(APPROVED_PAYLOAD));
    expect(res.status).toBe(200);

    const payment = await dbRaw.passportPayment.findUnique({ where: { orderNumber: ORDER } });
    expect(payment!.status).toBe("SUCCESS");
    expect(payment!.monriApprovalCode).toBe("APPROV123");
    expect(payment!.callbackReceivedAt).not.toBeNull();

    const passport = await dbRaw.waiterPassport.findUnique({ where: { userId } });
    expect(passport!.passportTier).toBe("PRO");
    expect(passport!.tierRank).toBe(1);
    expect(passport!.subscriptionExpiresAt).not.toBeNull();
  });

  it("PRO_PLUS tier sets tierRank=2", async () => {
    await dbRaw.passportPayment.update({
      where: { orderNumber: ORDER },
      data:  { tier: "PRO_PLUS" },
    });
    await POST(makeReq(APPROVED_PAYLOAD));
    const passport = await dbRaw.waiterPassport.findUnique({ where: { userId } });
    expect(passport!.passportTier).toBe("PRO_PLUS");
    expect(passport!.tierRank).toBe(2);
  });

  it("subscription extends from current expiry when already active", async () => {
    const futureExpiry = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000); // 20 days from now
    await dbRaw.waiterPassport.update({
      where: { userId },
      data:  { passportTier: "PRO", subscriptionExpiresAt: futureExpiry },
    });
    await POST(makeReq(APPROVED_PAYLOAD));
    const passport = await dbRaw.waiterPassport.findUnique({ where: { userId } });
    // Expiry must extend FROM futureExpiry, not from now (no date drift)
    expect(passport!.subscriptionExpiresAt!.getTime()).toBeGreaterThan(futureExpiry.getTime());
  });

  // ── Rejected payment ──────────────────────────────────────────────────────────

  it("rejected callback: payment FAILED, passport tier unchanged", async () => {
    vi.mocked(callbackApproved).mockReturnValue(false);
    const res = await POST(makeReq(APPROVED_PAYLOAD));
    expect(res.status).toBe(200);

    const payment = await dbRaw.passportPayment.findUnique({ where: { orderNumber: ORDER } });
    expect(payment!.status).toBe("FAILED");

    const passport = await dbRaw.waiterPassport.findUnique({ where: { userId } });
    expect(passport!.passportTier).toBe("FREE");
    expect(passport!.subscriptionExpiresAt).toBeNull();
  });

  // ── Idempotency — the critical blind spot ─────────────────────────────────────

  it("idempotency fast-path: already-SUCCESS → 200 without re-writing DB", async () => {
    await POST(makeReq(APPROVED_PAYLOAD)); // first call processes
    const firstCallAt = (await dbRaw.passportPayment.findUnique({ where: { orderNumber: ORDER } }))!
      .callbackReceivedAt;

    // Second call — hits status === "SUCCESS" early return, no updateMany
    const res = await POST(makeReq(APPROVED_PAYLOAD));
    expect(res.status).toBe(200);

    const payment = await dbRaw.passportPayment.findUnique({ where: { orderNumber: ORDER } });
    // callbackReceivedAt must NOT change — the DB was not touched again
    expect(payment!.callbackReceivedAt!.toISOString()).toBe(firstCallAt!.toISOString());
  });

  it("concurrent callbacks: PostgreSQL row-lock ensures exactly one activation", async () => {
    // Two simultaneous callbacks for the same order.
    // The updateMany WHERE callbackReceivedAt IS NULL claim is atomic —
    // PostgreSQL serializes row updates; only one request gets count=1.
    // Unit test mocked this — this test proves real DB behaviour.
    const [res1, res2] = await Promise.all([
      POST(makeReq(APPROVED_PAYLOAD)),
      POST(makeReq(APPROVED_PAYLOAD)),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // DB state: exactly one SUCCESS, one callbackReceivedAt timestamp
    const payment = await dbRaw.passportPayment.findUnique({ where: { orderNumber: ORDER } });
    expect(payment!.status).toBe("SUCCESS");
    expect(payment!.callbackReceivedAt).not.toBeNull();

    // Passport activated exactly once (PRO, not double-extended)
    const passport = await dbRaw.waiterPassport.findUnique({ where: { userId } });
    expect(passport!.passportTier).toBe("PRO");
    // subscriptionExpiresAt ~ 30 days from now, not 60
    const thirtyDaysMs  = 30 * 24 * 60 * 60 * 1000;
    const expectedExpiry = Date.now() + thirtyDaysMs;
    expect(passport!.subscriptionExpiresAt!.getTime()).toBeLessThan(expectedExpiry + 5_000);
    expect(passport!.subscriptionExpiresAt!.getTime()).toBeGreaterThan(expectedExpiry - 5_000);
  });
});
