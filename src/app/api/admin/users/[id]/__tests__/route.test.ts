import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  dbRaw: {
    user:            { update: vi.fn() },
    tokenRevocation: { upsert: vi.fn() },
    $transaction:    vi.fn(),
  },
}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));

import { getServerSession } from "next-auth";
import { dbRaw } from "@/lib/db";
import { PATCH } from "../route";

const ADMIN_ID  = "admin-1";
const TARGET_ID = "user-2";

const UPDATED_USER = {
  id: TARGET_ID,
  name: "Target User",
  email: "target@test.com",
  role: "WAITER",
  deletedAt: null,
};

function makeCtx(id = TARGET_ID) {
  return { params: Promise.resolve({ id }) };
}

function makeReq(body: object) {
  return new NextRequest(`http://localhost/api/admin/users/${TARGET_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(id = ADMIN_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role: "ADMIN" } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("PATCH /api/admin/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(dbRaw.$transaction).mockResolvedValue([UPDATED_USER] as never);
  });

  it("ADMIN changes role → 200", async () => {
    const res = await PATCH(makeReq({ role: "HEADHUNTER" }), makeCtx());
    expect(res.status).toBe(200);
    expect(vi.mocked(dbRaw.$transaction)).toHaveBeenCalledOnce();
  });

  it("ADMIN soft-deletes user → 200", async () => {
    const res = await PATCH(makeReq({ action: "delete" }), makeCtx());
    expect(res.status).toBe(200);
  });

  it("ADMIN restores user → 200", async () => {
    const res = await PATCH(makeReq({ action: "restore" }), makeCtx());
    expect(res.status).toBe(200);
  });

  it("non-ADMIN → 403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "o-1", role: "VENUE_OWNER" } } as never);
    const res = await PATCH(makeReq({ action: "delete" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await PATCH(makeReq({ action: "delete" }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("self-modification blocked → 400", async () => {
    const res = await PATCH(makeReq({ action: "delete" }), makeCtx(ADMIN_ID));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/own account/);
  });

  it("empty body → 400 (nothing to update)", async () => {
    const res = await PATCH(makeReq({}), makeCtx());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Nothing to update/);
  });

  it("invalid role ignored → nothing to update → 400", async () => {
    const res = await PATCH(makeReq({ role: "SUPERUSER" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("role change triggers tokenRevocation upsert", async () => {
    await PATCH(makeReq({ role: "HEADHUNTER" }), makeCtx());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txCall = vi.mocked(dbRaw.$transaction).mock.calls[0][0] as any;
    // transaction array should have 2 items: user.update + tokenRevocation.upsert
    expect(txCall).toHaveLength(2);
  });

  it("delete action triggers tokenRevocation upsert", async () => {
    await PATCH(makeReq({ action: "delete" }), makeCtx());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txCall = vi.mocked(dbRaw.$transaction).mock.calls[0][0] as any;
    expect(txCall).toHaveLength(2);
  });

  it("restore action triggers tokenRevocation upsert", async () => {
    await PATCH(makeReq({ action: "restore" }), makeCtx());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txCall = vi.mocked(dbRaw.$transaction).mock.calls[0][0] as any;
    expect(txCall).toHaveLength(2);
  });
});
