import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    waiterPassport: { upsert: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { POST } from "../route";

function makeReq() { return new NextRequest("http://localhost/api/test"); }

const CTX = { params: Promise.resolve({}) };

const WAITER_ID = "waiter-1";

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

function mockSession(role = "WAITER", id = WAITER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("POST /api/passport/share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.waiterPassport.upsert).mockResolvedValue({
      shareToken: "tok-abc123",
      shareTokenExpiry: FUTURE,
    } as never);
  });

  it("WAITER generates share token → 200", async () => {
    const res = await POST(makeReq(), CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.shareToken).toBeDefined();
    expect(json.shareTokenExpiry).toBeDefined();
  });

  it("upserts with 30-day expiry", async () => {
    await POST(makeReq(), CTX);

    const call = vi.mocked(db.waiterPassport.upsert).mock.calls[0][0] as {
      update: { shareTokenExpiry: Date };
    };
    const expiry = call.update.shareTokenExpiry;
    const diffDays = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(29);
    expect(diffDays).toBeLessThan(31);
  });

  it("VENUE_OWNER → 403", async () => {
    mockSession("VENUE_OWNER", "o-1");
    const res = await POST(makeReq(), CTX);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await POST(makeReq(), CTX);
    expect(res.status).toBe(401);
  });
});
