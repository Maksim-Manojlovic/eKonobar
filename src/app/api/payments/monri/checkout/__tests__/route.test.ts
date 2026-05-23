import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    user:            { findUnique: vi.fn() },
    passportPayment: { create: vi.fn() },
  },
}));
vi.mock("@/lib/monri", () => ({ createPaymentSession: vi.fn() }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { createPaymentSession } from "@/lib/monri";
import { POST } from "../route";

const WAITER_ID = "waiter-1";
const PAY_URL   = "https://ipgtest.monri.com/v2/form/abc123";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/payments/monri/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(role = "WAITER", id = WAITER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("POST /api/payments/monri/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.user.findUnique).mockResolvedValue({ name: "Marko", email: "m@test.com" } as never);
    vi.mocked(db.passportPayment.create).mockResolvedValue({} as never);
    vi.mocked(createPaymentSession).mockResolvedValue({ paymentUrl: PAY_URL } as never);
  });

  it("WAITER with PRO tier → 200 with paymentUrl", async () => {
    const res = await POST(makeReq({ tier: "PRO" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.paymentUrl).toBe(PAY_URL);
  });

  it("WAITER with PRO_PLUS tier → 200", async () => {
    const res = await POST(makeReq({ tier: "PRO_PLUS" }));
    expect(res.status).toBe(200);
  });

  it("FREE tier → 400 (invalid)", async () => {
    const res = await POST(makeReq({ tier: "FREE" }));
    expect(res.status).toBe(400);
  });

  it("missing tier → 400", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("invalid tier string → 400", async () => {
    const res = await POST(makeReq({ tier: "GOLD" }));
    expect(res.status).toBe(400);
  });

  it("VENUE_OWNER → 403", async () => {
    mockSession("VENUE_OWNER", "o-1");
    const res = await POST(makeReq({ tier: "PRO" }));
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await POST(makeReq({ tier: "PRO" }));
    expect(res.status).toBe(401);
  });

  it("user not found → 404", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    const res = await POST(makeReq({ tier: "PRO" }));
    expect(res.status).toBe(404);
  });

  it("creates PENDING payment record before calling Monri", async () => {
    await POST(makeReq({ tier: "PRO" }));

    expect(vi.mocked(db.passportPayment.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING", tier: "PRO", amountRsd: 29000 }),
      }),
    );
  });

  it("PRO_PLUS amount is 49000 minor units", async () => {
    await POST(makeReq({ tier: "PRO_PLUS" }));

    expect(vi.mocked(db.passportPayment.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountRsd: 49000 }),
      }),
    );
  });

  it("orderNumber has EK- prefix", async () => {
    await POST(makeReq({ tier: "PRO" }));

    const call = vi.mocked(db.passportPayment.create).mock.calls[0][0] as {
      data: { orderNumber: string };
    };
    expect(call.data.orderNumber).toMatch(/^EK-/);
  });
});
