import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/core/db", () => ({
  dbRaw: {
    notification: { findMany: vi.fn() },
  },
  db: {
    notification: { update: vi.fn() },
    pushSubscription: { delete: vi.fn() },
  },
}));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: vi.fn() }));
vi.mock("@/lib/integrations/sms",       () => ({ sendSms:      vi.fn() }));

import { dbRaw, db } from "@/lib/core/db";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { sendSms }      from "@/lib/integrations/sms";
import { GET, POST }    from "../route";

const SECRET = "test-secret";


const BASE_NOTIF = {
  id: "n-1",
  title: "Obaveštenje",
  body: "Detalji",
  link: "/dashboard",
  waSent: false,
  waRetries: 0,
  smsSent: false,
  smsRetries: 0,
  user: {
    phone: "+381611234567",
    waOptIn: true,
    smsOptIn: true,
  },
};

function makeReq(method: "GET" | "POST" = "GET") {
  return new NextRequest("http://localhost/api/cron/retry-notifications", {
    method,
    headers: { Authorization: `Bearer ${SECRET}` },
  });
}

function makeUnauthorizedReq(method: "GET" | "POST" = "GET") {
  return new NextRequest("http://localhost/api/cron/retry-notifications", { method });
}

describe("GET /api/cron/retry-notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.mocked(dbRaw.notification.findMany).mockResolvedValue([]);
    vi.mocked(db.notification.update).mockResolvedValue(undefined as never);
    vi.mocked(sendWhatsApp).mockResolvedValue(undefined);
    vi.mocked(sendSms).mockResolvedValue(undefined);
  });

  it("authorized request → 200", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
  });

  it("missing auth → 401", async () => {
    const res = await GET(makeUnauthorizedReq());
    expect(res.status).toBe(401);
  });

  it("empty CRON_SECRET → 401", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("no pending → checked:0 waSent:0 smsSent:0", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json).toEqual({ checked: 0, waSent: 0, waFailed: 0, smsSent: 0, smsFailed: 0 });
  });

  it("WhatsApp retry succeeds → waSent:1", async () => {
    vi.mocked(dbRaw.notification.findMany).mockResolvedValue([BASE_NOTIF] as never);
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.waSent).toBe(1);
    expect(json.waFailed).toBe(0);
  });

  it("SMS retry succeeds → smsSent:1", async () => {
    vi.mocked(dbRaw.notification.findMany).mockResolvedValue([BASE_NOTIF] as never);
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.smsSent).toBe(1);
    expect(json.smsFailed).toBe(0);
  });

  it("WhatsApp send throws → waFailed:1", async () => {
    vi.mocked(dbRaw.notification.findMany).mockResolvedValue([BASE_NOTIF] as never);
    vi.mocked(sendWhatsApp).mockRejectedValue(new Error("WA down"));
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.waFailed).toBe(1);
  });

  it("SMS send throws → smsFailed:1", async () => {
    vi.mocked(dbRaw.notification.findMany).mockResolvedValue([BASE_NOTIF] as never);
    vi.mocked(sendSms).mockRejectedValue(new Error("SMS down"));
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.smsFailed).toBe(1);
  });

  it("smsOptIn=false skips SMS", async () => {
    vi.mocked(dbRaw.notification.findMany).mockResolvedValue([
      { ...BASE_NOTIF, user: { ...BASE_NOTIF.user, smsOptIn: false } },
    ] as never);
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.smsSent).toBe(0);
  });

  it("waOptIn=false skips WhatsApp", async () => {
    vi.mocked(dbRaw.notification.findMany).mockResolvedValue([
      { ...BASE_NOTIF, user: { ...BASE_NOTIF.user, waOptIn: false } },
    ] as never);
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.waSent).toBe(0);
  });

  it("marks waSent=true on success", async () => {
    vi.mocked(dbRaw.notification.findMany).mockResolvedValue([BASE_NOTIF] as never);
    await GET(makeReq());
    expect(vi.mocked(db.notification.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { waSent: true } }),
    );
  });
});

describe("POST /api/cron/retry-notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.mocked(dbRaw.notification.findMany).mockResolvedValue([]);
    vi.mocked(db.notification.update).mockResolvedValue(undefined as never);
  });

  it("authorized POST → 200", async () => {
    const res = await POST(makeReq("POST"));
    expect(res.status).toBe(200);
  });

  it("unauthorized POST → 401", async () => {
    const res = await POST(makeUnauthorizedReq("POST"));
    expect(res.status).toBe(401);
  });
});
