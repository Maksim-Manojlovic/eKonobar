import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    invite: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { PATCH } from "../route";

const INVITE_ID = "invite-1";
const WAITER_ID = "waiter-1";

const BASE_INVITE = {
  id: INVITE_ID,
  recipientId: WAITER_ID,
  type: "JOB_INVITE",
  status: "PENDING",
};

function makeReq(body: object) {
  return new NextRequest(`http://localhost/api/invites/${INVITE_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeCtx() {
  return { params: Promise.resolve({ id: INVITE_ID }) };
}

function mockSession(role = "WAITER", id = WAITER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

describe("PATCH /api/invites/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.invite.findFirst).mockResolvedValue(BASE_INVITE as never);
    vi.mocked(db.invite.update).mockResolvedValue({ ...BASE_INVITE } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await PATCH(makeReq({ status: "ACCEPTED" }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is not WAITER", async () => {
    mockSession("VENUE_OWNER");
    const res = await PATCH(makeReq({ status: "ACCEPTED" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 when invite not found or not recipient", async () => {
    vi.mocked(db.invite.findFirst).mockResolvedValue(null);
    const res = await PATCH(makeReq({ status: "ACCEPTED" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns 400 when invite already responded", async () => {
    vi.mocked(db.invite.findFirst).mockResolvedValue({
      ...BASE_INVITE, status: "ACCEPTED",
    } as never);
    const res = await PATCH(makeReq({ status: "ACCEPTED" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid status value", async () => {
    const res = await PATCH(makeReq({ status: "PENDING" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("ACCEPTED: sets usedAt timestamp", async () => {
    await PATCH(makeReq({ status: "ACCEPTED" }), makeCtx());
    const data = vi.mocked(db.invite.update).mock.calls[0][0].data;
    expect(data.status).toBe("ACCEPTED");
    expect(data.usedAt).toBeInstanceOf(Date);
  });

  it("DECLINED: does not set usedAt", async () => {
    await PATCH(makeReq({ status: "DECLINED" }), makeCtx());
    const data = vi.mocked(db.invite.update).mock.calls[0][0].data;
    expect(data.status).toBe("DECLINED");
    expect(data.usedAt).toBeUndefined();
  });

  it("scopes lookup to recipient and invite type", async () => {
    await PATCH(makeReq({ status: "ACCEPTED" }), makeCtx());
    const where = vi.mocked(db.invite.findFirst).mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({ id: INVITE_ID, recipientId: WAITER_ID, type: "JOB_INVITE" });
  });
});
