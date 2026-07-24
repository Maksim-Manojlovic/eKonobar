import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/core/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/integrations/email", () => ({ sendDemoLeadEmail: vi.fn() }));
vi.mock("@/lib/core/ip", () => ({ getClientIp: vi.fn().mockReturnValue("1.2.3.4") }));
vi.mock("@/lib/core/logger", () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { rateLimit } from "@/lib/core/rate-limit";
import { sendDemoLeadEmail } from "@/lib/integrations/email";
import logger from "@/lib/core/logger";
import { POST } from "../route";

const VALID = { venueName: "Salon 1905", name: "Marko", phone: "0641234567", venueType: "Bar / kafe" };

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue(true);
    vi.mocked(sendDemoLeadEmail).mockResolvedValue(undefined);
  });

  it("returns 429 when rate-limited", async () => {
    vi.mocked(rateLimit).mockResolvedValue(false);
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(429);
    expect(sendDemoLeadEmail).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid body (missing venueName)", async () => {
    const res = await POST(makeReq({ name: "Marko", phone: "0641234567" }));
    expect(res.status).toBe(400);
    expect(sendDemoLeadEmail).not.toHaveBeenCalled();
  });

  it("captures a valid lead: 200, logs, fires email", async () => {
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(sendDemoLeadEmail).toHaveBeenCalledWith(expect.objectContaining({ venueName: "Salon 1905", phone: "0641234567" }));
    expect(logger.info).toHaveBeenCalled();
  });

  it("still returns 200 when the ops email throws (best-effort)", async () => {
    vi.mocked(sendDemoLeadEmail).mockRejectedValue(new Error("smtp down"));
    const res = await POST(makeReq(VALID));
    expect(res.status).toBe(200);
  });
});
