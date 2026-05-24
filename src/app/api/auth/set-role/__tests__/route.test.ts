import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { update: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { PATCH } from "../route";

const CTX = { params: Promise.resolve({}) };

const USER_ID = "user-1";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/auth/set-role", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(id = USER_ID, role = "WAITER") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("PATCH /api/auth/set-role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.user.update).mockResolvedValue({ id: USER_ID } as never);
  });

  it("sets WAITER role → 200", async () => {
    const res = await PATCH(makeReq({ role: "WAITER" }), CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.role).toBe("WAITER");
  });

  it("sets VENUE_OWNER role → 200", async () => {
    const res = await PATCH(makeReq({ role: "VENUE_OWNER" }), CTX);
    expect(res.status).toBe(200);
  });

  it("sets HEADHUNTER role → 200", async () => {
    const res = await PATCH(makeReq({ role: "HEADHUNTER" }), CTX);
    expect(res.status).toBe(200);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await PATCH(makeReq({ role: "WAITER" }), CTX);
    expect(res.status).toBe(401);
  });

  it("ADMIN role rejected → 400", async () => {
    const res = await PATCH(makeReq({ role: "ADMIN" }), CTX);
    expect(res.status).toBe(400);
  });

  it("invalid role → 400", async () => {
    const res = await PATCH(makeReq({ role: "SUPERUSER" }), CTX);
    expect(res.status).toBe(400);
  });

  it("missing role → 400", async () => {
    const res = await PATCH(makeReq({}), CTX);
    expect(res.status).toBe(400);
  });

  it("updates correct user id", async () => {
    await PATCH(makeReq({ role: "VENUE_OWNER" }), CTX);
    expect(vi.mocked(db.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID }, data: { role: "VENUE_OWNER" } }),
    );
  });
});
