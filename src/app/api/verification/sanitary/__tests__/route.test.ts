import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db:    { sanitaryBook: { findUnique: vi.fn(), upsert: vi.fn() } },
  dbRaw: { sanitaryBook: { findMany: vi.fn() } },
}));

import { getServerSession } from "next-auth";
import { db, dbRaw } from "@/lib/db";
import { GET, POST } from "../route";

const ADMIN_ID  = "admin-1";
const WAITER_ID = "waiter-1";

const PENDING_BOOK = {
  id: "sb-1",
  userId: WAITER_ID,
  status: "PENDING",
  fileUrl: "https://res.cloudinary.com/test/file.pdf",
  expiryDate: null,
  uploadedAt: new Date(),
  rejectReason: null,
  reviewedBy: null,
  reviewedAt: null,
  user: { id: WAITER_ID, name: "Marko", email: "m@test.com" },
};

function makePostReq(body: object) {
  return new NextRequest("http://localhost/api/verification/sanitary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(role: string, id: string) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("GET /api/verification/sanitary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ADMIN gets all PENDING submissions", async () => {
    mockSession("ADMIN", ADMIN_ID);
    vi.mocked(dbRaw.sanitaryBook.findMany).mockResolvedValue([PENDING_BOOK] as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(vi.mocked(dbRaw.sanitaryBook.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PENDING" } }),
    );
  });

  it("WAITER gets own sanitary book", async () => {
    mockSession("WAITER", WAITER_ID);
    vi.mocked(db.sanitaryBook.findUnique).mockResolvedValue(PENDING_BOOK as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.userId).toBe(WAITER_ID);
  });

  it("WAITER with no book → null", async () => {
    mockSession("WAITER", WAITER_ID);
    vi.mocked(db.sanitaryBook.findUnique).mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("VENUE_OWNER → 403", async () => {
    mockSession("VENUE_OWNER", "o-1");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("POST /api/verification/sanitary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.sanitaryBook.upsert).mockResolvedValue(PENDING_BOOK as never);
  });

  it("WAITER submits fileUrl → 201", async () => {
    mockSession("WAITER", WAITER_ID);
    const res = await POST(makePostReq({ fileUrl: "https://cdn.test/doc.pdf" }));
    expect(res.status).toBe(201);
    expect(vi.mocked(db.sanitaryBook.upsert)).toHaveBeenCalledOnce();
  });

  it("re-submit clears prior review fields", async () => {
    mockSession("WAITER", WAITER_ID);
    await POST(makePostReq({ fileUrl: "https://cdn.test/doc.pdf" }));

    const call = vi.mocked(db.sanitaryBook.upsert).mock.calls[0][0] as {
      update: Record<string, unknown>;
    };
    expect(call.update.reviewedBy).toBeNull();
    expect(call.update.reviewedAt).toBeNull();
    expect(call.update.rejectReason).toBeNull();
    expect(call.update.status).toBe("PENDING");
  });

  it("missing fileUrl → 400", async () => {
    mockSession("WAITER", WAITER_ID);
    const res = await POST(makePostReq({}));
    expect(res.status).toBe(400);
  });

  it("non-string fileUrl → 400", async () => {
    mockSession("WAITER", WAITER_ID);
    const res = await POST(makePostReq({ fileUrl: 123 }));
    expect(res.status).toBe(400);
  });

  it("VENUE_OWNER → 403", async () => {
    mockSession("VENUE_OWNER", "o-1");
    const res = await POST(makePostReq({ fileUrl: "https://cdn.test/doc.pdf" }));
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await POST(makePostReq({ fileUrl: "https://cdn.test/doc.pdf" }));
    expect(res.status).toBe(401);
  });
});
