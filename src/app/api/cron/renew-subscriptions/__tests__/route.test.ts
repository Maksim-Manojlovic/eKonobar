import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  dbRaw: {
    waiterPassport:  { findMany: vi.fn(), update: vi.fn() },
    passportPayment: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction:    vi.fn(),
  },
}));
vi.mock("@/lib/monri",  () => ({ chargeStoredCard: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn().mockResolvedValue(undefined) }));

import { dbRaw } from "@/lib/db";
import { chargeStoredCard } from "@/lib/monri";
import { notify } from "@/lib/notify";
import { GET, POST } from "../route";

const SECRET = "renew-secret";

const PRO_PASSPORT = {
  userId:                "waiter-1",
  passportTier:          "PRO",
  subscriptionExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
  monriPanToken:         "pan-token-abc",
  user:                  { email: "w@test.com", name: "Marko" },
};

function makeReq(method: "GET" | "POST", auth?: string) {
  const headers: Record<string, string> = {};
  if (auth !== undefined) headers["authorization"] = auth;
  return new NextRequest("http://localhost/api/cron/renew-subscriptions", { method, headers });
}

describe("GET /api/cron/renew-subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.mocked(dbRaw.waiterPassport.findMany).mockResolvedValue([]);
    vi.mocked(dbRaw.passportPayment.findFirst).mockResolvedValue(null);
    vi.mocked(dbRaw.passportPayment.create).mockResolvedValue({} as never);
    vi.mocked(dbRaw.$transaction).mockResolvedValue([{}, {}] as never);
  });

  it("valid secret → 200 with counts", async () => {
    const res = await GET(makeReq("GET", `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ checked: 0, renewed: 0, failed: 0 });
  });

  it("missing auth → 401", async () => {
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(401);
  });

  it("wrong secret → 401", async () => {
    const res = await GET(makeReq("GET", "Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("no CRON_SECRET env → 401", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(makeReq("GET", `Bearer ${SECRET}`));
    expect(res.status).toBe(401);
  });

  it("approved charge → renewed++ and extends expiry from current expiry", async () => {
    vi.mocked(dbRaw.waiterPassport.findMany).mockResolvedValue([PRO_PASSPORT] as never);
    vi.mocked(chargeStoredCard).mockResolvedValue({ approved: true, approvalCode: "CODE123" } as never);

    const res = await GET(makeReq("GET", `Bearer ${SECRET}`));
    const json = await res.json();
    expect(json).toMatchObject({ checked: 1, renewed: 1, failed: 0 });

    // transaction called for success path
    expect(vi.mocked(dbRaw.$transaction)).toHaveBeenCalledOnce();
  });

  it("approved charge → notifies user", async () => {
    vi.mocked(dbRaw.waiterPassport.findMany).mockResolvedValue([PRO_PASSPORT] as never);
    vi.mocked(chargeStoredCard).mockResolvedValue({ approved: true, approvalCode: "CODE" } as never);

    await GET(makeReq("GET", `Bearer ${SECRET}`));
    await new Promise(r => setTimeout(r, 0));

    expect(vi.mocked(notify)).toHaveBeenCalledWith(
      "waiter-1",
      "APPLICATION_STATUS_CHANGED",
      expect.stringContaining("obnovljena"),
      expect.any(String),
      "/waiter",
      { isPro: true, isProPlus: false },
    );
  });

  it("failed charge → failed++ and marks payment FAILED", async () => {
    vi.mocked(dbRaw.waiterPassport.findMany).mockResolvedValue([PRO_PASSPORT] as never);
    vi.mocked(chargeStoredCard).mockResolvedValue({ approved: false, approvalCode: undefined } as never);

    const res = await GET(makeReq("GET", `Bearer ${SECRET}`));
    const json = await res.json();
    expect(json).toMatchObject({ checked: 1, renewed: 0, failed: 1 });
  });

  it("failed charge → notifies user of failure", async () => {
    vi.mocked(dbRaw.waiterPassport.findMany).mockResolvedValue([PRO_PASSPORT] as never);
    vi.mocked(chargeStoredCard).mockResolvedValue({ approved: false, approvalCode: undefined } as never);

    await GET(makeReq("GET", `Bearer ${SECRET}`));
    await new Promise(r => setTimeout(r, 0));

    expect(vi.mocked(notify)).toHaveBeenCalledWith(
      "waiter-1",
      "APPLICATION_STATUS_CHANGED",
      expect.stringContaining("nije uspela"),
      expect.any(String),
      "/waiter",
    );
  });

  it("dedup guard: skips passport with recent payment attempt", async () => {
    vi.mocked(dbRaw.waiterPassport.findMany).mockResolvedValue([PRO_PASSPORT] as never);
    vi.mocked(dbRaw.passportPayment.findFirst).mockResolvedValue({ id: "pay-1" } as never);

    const res = await GET(makeReq("GET", `Bearer ${SECRET}`));
    const json = await res.json();
    // checked=1 but no charge attempted
    expect(json.checked).toBe(1);
    expect(vi.mocked(chargeStoredCard)).not.toHaveBeenCalled();
  });

  it("chargeStoredCard exception treated as failed", async () => {
    vi.mocked(dbRaw.waiterPassport.findMany).mockResolvedValue([PRO_PASSPORT] as never);
    vi.mocked(chargeStoredCard).mockRejectedValue(new Error("network error"));

    const res = await GET(makeReq("GET", `Bearer ${SECRET}`));
    const json = await res.json();
    expect(json.failed).toBe(1);
  });
});

describe("POST /api/cron/renew-subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.mocked(dbRaw.waiterPassport.findMany).mockResolvedValue([]);
  });

  it("valid secret → 200", async () => {
    const res = await POST(makeReq("POST", `Bearer ${SECRET}`));
    expect(res.status).toBe(200);
  });

  it("missing auth → 401", async () => {
    const res = await POST(makeReq("POST"));
    expect(res.status).toBe(401);
  });
});
