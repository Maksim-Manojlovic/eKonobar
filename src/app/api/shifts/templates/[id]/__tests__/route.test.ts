import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    shiftTemplate: { update: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/shifts/auth", () => ({ getManagedTemplate: vi.fn() }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { getManagedTemplate } from "@/lib/shifts/auth";
import { PATCH, DELETE } from "../route";

const OWNER_ID   = "owner-1";
const TEMPLATE_ID = "t-1";

const TEMPLATE = { id: TEMPLATE_ID, venueId: "v-1", name: "Evening" };

function makeCtx(id = TEMPLATE_ID) {
  return { params: Promise.resolve({ id }) };
}

function makePatchReq(body: object) {
  return new NextRequest(`http://localhost/api/shifts/templates/${TEMPLATE_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteReq() {
  return new NextRequest(`http://localhost/api/shifts/templates/${TEMPLATE_ID}`, { method: "DELETE" });
}

function mockSession(role = "VENUE_OWNER", id = OWNER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("PATCH /api/shifts/templates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(getManagedTemplate).mockResolvedValue(TEMPLATE as never);
    vi.mocked(db.shiftTemplate.update).mockResolvedValue({ ...TEMPLATE, name: "Updated" } as never);
  });

  it("VENUE_OWNER updates template → 200", async () => {
    const res = await PATCH(makePatchReq({ name: "Updated" }), makeCtx());
    expect(res.status).toBe(200);
  });

  it("HEADHUNTER → 403", async () => {
    mockSession("HEADHUNTER", "h-1");
    const res = await PATCH(makePatchReq({ name: "X" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await PATCH(makePatchReq({ name: "X" }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("template not found → 404", async () => {
    vi.mocked(getManagedTemplate).mockResolvedValue(null);
    const res = await PATCH(makePatchReq({ name: "X" }), makeCtx("bad-id"));
    expect(res.status).toBe(404);
  });

  it("WAITER (headWaiter) can update → 200", async () => {
    mockSession("WAITER", "w-1");
    const res = await PATCH(makePatchReq({ name: "X" }), makeCtx());
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/shifts/templates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(getManagedTemplate).mockResolvedValue(TEMPLATE as never);
    vi.mocked(db.shiftTemplate.delete).mockResolvedValue(TEMPLATE as never);
  });

  it("VENUE_OWNER deletes template → 200", async () => {
    const res = await DELETE(makeDeleteReq(), makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("HEADHUNTER → 403", async () => {
    mockSession("HEADHUNTER", "h-1");
    const res = await DELETE(makeDeleteReq(), makeCtx());
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await DELETE(makeDeleteReq(), makeCtx());
    expect(res.status).toBe(401);
  });

  it("template not found → 404", async () => {
    vi.mocked(getManagedTemplate).mockResolvedValue(null);
    const res = await DELETE(makeDeleteReq(), makeCtx("bad-id"));
    expect(res.status).toBe(404);
  });

  it("deletes by id", async () => {
    await DELETE(makeDeleteReq(), makeCtx());
    expect(vi.mocked(db.shiftTemplate.delete)).toHaveBeenCalledWith({ where: { id: TEMPLATE_ID } });
  });
});
