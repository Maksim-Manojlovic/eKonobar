import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    notification: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { GET, PATCH } from "../route";

const USER_ID = "user-1";

const NOTIF = {
  id: "n-1",
  userId: USER_ID,
  type: "SHIFT_ASSIGNED",
  title: "Smena",
  body: "Assigned to morning shift",
  read: false,
  createdAt: new Date(),
};

function makePatchReq(body: object) {
  return new NextRequest("http://localhost/api/notifications", {
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

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.notification.findMany).mockResolvedValue([NOTIF] as never);
    vi.mocked(db.notification.count).mockResolvedValue(1);
  });

  it("returns notifications + unreadCount", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.notifications).toHaveLength(1);
    expect(json.unreadCount).toBe(1);
  });

  it("scoped to current user", async () => {
    await GET();
    expect(vi.mocked(db.notification.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } }),
    );
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.notification.updateMany).mockResolvedValue({ count: 1 });
  });

  it("marks specific ids as read", async () => {
    const res = await PATCH(makePatchReq({ ids: ["n-1", "n-2"] }));
    expect(res.status).toBe(200);
    expect(vi.mocked(db.notification.updateMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["n-1", "n-2"] } }),
        data: { read: true },
      }),
    );
  });

  it("empty ids array → marks all read", async () => {
    const res = await PATCH(makePatchReq({ ids: [] }));
    expect(res.status).toBe(200);
    expect(vi.mocked(db.notification.updateMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ read: false }),
        data: { read: true },
      }),
    );
  });

  it("no ids field → marks all read", async () => {
    const res = await PATCH(makePatchReq({}));
    expect(res.status).toBe(200);
    expect(vi.mocked(db.notification.updateMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, read: false },
      }),
    );
  });

  it("always scoped to current user", async () => {
    await PATCH(makePatchReq({ ids: ["n-1"] }));
    const call = vi.mocked(db.notification.updateMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(call.where.userId).toBe(USER_ID);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await PATCH(makePatchReq({ ids: ["n-1"] }));
    expect(res.status).toBe(401);
  });
});
