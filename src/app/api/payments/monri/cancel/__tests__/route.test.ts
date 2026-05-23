import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  dbRaw: {
    passportPayment: { updateMany: vi.fn() },
  },
}));

import { dbRaw } from "@/lib/db";
import { GET } from "../route";

function makeReq(orderNumber?: string) {
  const url = orderNumber
    ? `http://localhost/api/payments/monri/cancel?order_number=${orderNumber}`
    : "http://localhost/api/payments/monri/cancel";
  return new NextRequest(url);
}

describe("GET /api/payments/monri/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.mocked(dbRaw.passportPayment.updateMany).mockResolvedValue({ count: 1 } as never);
  });

  it("redirects to /waiter?payment=cancelled", async () => {
    const res = await GET(makeReq("EK-abc123"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("payment=cancelled");
  });

  it("updates payment status to CANCELLED when order_number provided", async () => {
    await GET(makeReq("EK-abc123"));
    expect(vi.mocked(dbRaw.passportPayment.updateMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderNumber: "EK-abc123", status: "PENDING" },
        data:  { status: "CANCELLED" },
      }),
    );
  });

  it("no order_number → still redirects", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("payment=cancelled");
  });

  it("no order_number → updateMany not called", async () => {
    await GET(makeReq());
    // empty string is falsy — route skips updateMany entirely
    expect(vi.mocked(dbRaw.passportPayment.updateMany)).not.toHaveBeenCalled();
  });

  it("redirect uses NEXT_PUBLIC_APP_URL env", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://ekonobar.rs");
    const res = await GET(makeReq("EK-x"));
    expect(res.headers.get("location")).toContain("https://ekonobar.rs");
  });
});
