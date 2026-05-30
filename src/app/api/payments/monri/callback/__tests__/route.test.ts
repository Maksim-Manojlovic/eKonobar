import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/core/db", () => ({
  dbRaw: {
    passportPayment: {
      findUnique:  vi.fn(),
      update:      vi.fn(),
      updateMany:  vi.fn(),
    },
    waiterPassport: { update: vi.fn() },
    $transaction: vi.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));
vi.mock("@/lib/integrations/monri", () => ({
  verifyCallback:   vi.fn().mockReturnValue(true),
  callbackApproved: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/notifications/notify", () => ({
  notify: vi.fn().mockResolvedValue(undefined),
  bustNotifyPrefsCache: vi.fn(),
}));
vi.mock("@/lib/passport/tier-cache", () => ({
  bustTierCache: vi.fn(),
}));

import { dbRaw } from "@/lib/core/db";
import { verifyCallback, callbackApproved } from "@/lib/integrations/monri";
import { POST } from "../route";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/payments/monri/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const PAYLOAD = {
  order_number: "EK-abc123",
  approval_code: "APPROV",
  pan_token: "tok_test",
  digest: "valid",
  response_code: "0000",
  status: "approved",
};

const PENDING_PAYMENT = {
  orderNumber: "EK-abc123",
  status: "PENDING",
  callbackReceivedAt: null,
  userId: "user-1",
  tier: "PRO",
  user: {
    id: "user-1",
    email: "test@test.com",
    waiterPassport: { subscriptionExpiresAt: null },
  },
};

describe("POST /api/payments/monri/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbRaw.passportPayment.update).mockResolvedValue({} as never);
    vi.mocked(dbRaw.waiterPassport.update).mockResolvedValue({} as never);
  });

  it("returns 400 when digest is invalid", async () => {
    vi.mocked(verifyCallback).mockReturnValueOnce(false);
    vi.mocked(dbRaw.passportPayment.findUnique).mockResolvedValue(PENDING_PAYMENT as never);
    const res = await POST(makeReq(PAYLOAD));
    expect(res.status).toBe(400);
  });

  it("returns 404 when order not found", async () => {
    vi.mocked(dbRaw.passportPayment.findUnique).mockResolvedValue(null);
    const res = await POST(makeReq(PAYLOAD));
    expect(res.status).toBe(404);
  });

  it("returns 200 without processing when already SUCCESS (idempotency fast-path)", async () => {
    vi.mocked(dbRaw.passportPayment.findUnique).mockResolvedValue({
      ...PENDING_PAYMENT, status: "SUCCESS",
    } as never);
    const res = await POST(makeReq(PAYLOAD));
    expect(res.status).toBe(200);
    expect(dbRaw.passportPayment.updateMany).not.toHaveBeenCalled();
  });

  it("returns 200 without processing when claim lost (concurrent callback)", async () => {
    vi.mocked(dbRaw.passportPayment.findUnique).mockResolvedValue(PENDING_PAYMENT as never);
    vi.mocked(dbRaw.passportPayment.updateMany).mockResolvedValue({ count: 0 } as never);
    const res = await POST(makeReq(PAYLOAD));
    expect(res.status).toBe(200);
    expect(dbRaw.$transaction).not.toHaveBeenCalled();
  });

  it("activates passport on approved callback", async () => {
    vi.mocked(dbRaw.passportPayment.findUnique).mockResolvedValue(PENDING_PAYMENT as never);
    vi.mocked(dbRaw.passportPayment.updateMany).mockResolvedValue({ count: 1 } as never);
    const res = await POST(makeReq(PAYLOAD));
    expect(res.status).toBe(200);
    expect(dbRaw.$transaction).toHaveBeenCalled();
  });

  it("marks FAILED on rejected payment without activating passport", async () => {
    vi.mocked(callbackApproved).mockReturnValueOnce(false);
    vi.mocked(dbRaw.passportPayment.findUnique).mockResolvedValue(PENDING_PAYMENT as never);
    vi.mocked(dbRaw.passportPayment.updateMany).mockResolvedValue({ count: 1 } as never);
    const res = await POST(makeReq(PAYLOAD));
    expect(res.status).toBe(200);
    expect(dbRaw.$transaction).not.toHaveBeenCalled();
    expect(dbRaw.passportPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
  });
});
