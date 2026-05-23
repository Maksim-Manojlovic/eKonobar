import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { GET, PATCH } from "../route";

const USER_ID = "user-1";

const PREFS = { phone: "+381601234567", smsOptIn: true, waOptIn: false };

function makePatchReq(body: object) {
  return new NextRequest("http://localhost/api/user/notification-prefs", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(id = USER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role: "WAITER" } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("GET /api/user/notification-prefs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.user.findUnique).mockResolvedValue(PREFS as never);
  });

  it("authenticated → returns prefs", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(PREFS);
  });

  it("user not found → returns default nulls", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    const res = await GET();
    const json = await res.json();
    expect(json).toEqual({ phone: null, smsOptIn: false, waOptIn: false });
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/user/notification-prefs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.user.update).mockResolvedValue(PREFS as never);
  });

  it("updates smsOptIn → 200", async () => {
    const res = await PATCH(makePatchReq({ smsOptIn: true }));
    expect(res.status).toBe(200);
    expect(vi.mocked(db.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { smsOptIn: true } }),
    );
  });

  it("updates waOptIn → 200", async () => {
    await PATCH(makePatchReq({ waOptIn: true }));
    expect(vi.mocked(db.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { waOptIn: true } }),
    );
  });

  it("phone trimmed and stored", async () => {
    await PATCH(makePatchReq({ phone: "  +381601234567  " }));
    const call = vi.mocked(db.user.update).mock.calls[0][0] as { data: { phone: string } };
    expect(call.data.phone).toBe("+381601234567");
  });

  it("empty string phone → stored as null", async () => {
    await PATCH(makePatchReq({ phone: "" }));
    const call = vi.mocked(db.user.update).mock.calls[0][0] as { data: { phone: null } };
    expect(call.data.phone).toBeNull();
  });

  it("non-string phone → stored as null", async () => {
    await PATCH(makePatchReq({ phone: 12345 }));
    const call = vi.mocked(db.user.update).mock.calls[0][0] as { data: { phone: null } };
    expect(call.data.phone).toBeNull();
  });

  it("non-boolean smsOptIn ignored", async () => {
    await PATCH(makePatchReq({ smsOptIn: "yes" }));
    const call = vi.mocked(db.user.update).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.smsOptIn).toBeUndefined();
  });

  it("partial update: only provided keys sent to DB", async () => {
    await PATCH(makePatchReq({ waOptIn: false }));
    const call = vi.mocked(db.user.update).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(Object.keys(call.data)).toEqual(["waOptIn"]);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await PATCH(makePatchReq({ smsOptIn: true }));
    expect(res.status).toBe(401);
  });
});
