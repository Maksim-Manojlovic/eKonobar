import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    pushSubscription: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { POST, DELETE } from "../route";

const CTX = { params: Promise.resolve({}) };

const USER_ID = "user-1";

const VALID_SUB = {
  endpoint: "https://fcm.googleapis.com/abc",
  keys: { p256dh: "key-p256dh", auth: "key-auth" },
};

function makePostReq(body: object) {
  return new NextRequest("http://localhost/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteReq(body: object) {
  return new NextRequest("http://localhost/api/push/subscribe", {
    method: "DELETE",
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

describe("POST /api/push/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.pushSubscription.upsert).mockResolvedValue(undefined as never);
  });

  it("valid subscription → 200", async () => {
    const res = await POST(makePostReq(VALID_SUB), CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await POST(makePostReq(VALID_SUB), CTX);
    expect(res.status).toBe(401);
  });

  it("missing endpoint → 400", async () => {
    const res = await POST(makePostReq({ keys: VALID_SUB.keys }), CTX);
    expect(res.status).toBe(400);
  });

  it("missing keys.p256dh → 400", async () => {
    const res = await POST(makePostReq({ endpoint: VALID_SUB.endpoint, keys: { auth: "x" } }), CTX);
    expect(res.status).toBe(400);
  });

  it("missing keys.auth → 400", async () => {
    const res = await POST(makePostReq({ endpoint: VALID_SUB.endpoint, keys: { p256dh: "x" } }), CTX);
    expect(res.status).toBe(400);
  });

  it("upserts with correct data", async () => {
    await POST(makePostReq(VALID_SUB), CTX);
    expect(vi.mocked(db.pushSubscription.upsert)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: VALID_SUB.endpoint },
        create: expect.objectContaining({ userId: USER_ID, endpoint: VALID_SUB.endpoint }),
        update: expect.objectContaining({ userId: USER_ID }),
      }),
    );
  });
});

describe("DELETE /api/push/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.pushSubscription.deleteMany).mockResolvedValue({ count: 1 } as never);
  });

  it("valid delete → 200", async () => {
    const res = await DELETE(makeDeleteReq({ endpoint: VALID_SUB.endpoint }), CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await DELETE(makeDeleteReq({ endpoint: VALID_SUB.endpoint }), CTX);
    expect(res.status).toBe(401);
  });

  it("missing endpoint → 400", async () => {
    const res = await DELETE(makeDeleteReq({}), CTX);
    expect(res.status).toBe(400);
  });

  it("deletes scoped to userId and endpoint", async () => {
    await DELETE(makeDeleteReq({ endpoint: VALID_SUB.endpoint }), CTX);
    expect(vi.mocked(db.pushSubscription.deleteMany)).toHaveBeenCalledWith({
      where: { endpoint: VALID_SUB.endpoint, userId: USER_ID },
    });
  });
});
