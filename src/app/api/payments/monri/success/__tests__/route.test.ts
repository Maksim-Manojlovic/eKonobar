import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "../route";

function makeReq(orderNumber?: string) {
  const url = orderNumber
    ? `http://localhost/api/payments/monri/success?order_number=${orderNumber}`
    : "http://localhost/api/payments/monri/success";
  return new NextRequest(url);
}

describe("GET /api/payments/monri/success", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  });

  it("redirects to /waiter?payment=success", async () => {
    const res = GET(makeReq("EK-abc123"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("payment=success");
  });

  it("order number included in redirect URL", async () => {
    const res = GET(makeReq("EK-abc123"));
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("order=EK-abc123");
  });

  it("no order_number → order= empty string", async () => {
    const res = GET(makeReq());
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("payment=success");
    expect(location).toContain("order=");
  });

  it("uses NEXT_PUBLIC_APP_URL env", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://ekonobar.rs");
    const res = GET(makeReq("EK-x"));
    expect(res.headers.get("location")).toContain("https://ekonobar.rs");
  });
});
