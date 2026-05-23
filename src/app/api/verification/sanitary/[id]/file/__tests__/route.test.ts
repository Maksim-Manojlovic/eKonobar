import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  dbRaw: {
    sanitaryBook: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/cloudinary", () => ({
  signCloudinaryUrl: vi.fn().mockReturnValue("https://res.cloudinary.com/signed?token=abc"),
}));

import { getServerSession } from "next-auth";
import { dbRaw } from "@/lib/db";
import { signCloudinaryUrl } from "@/lib/cloudinary";
import { GET } from "../route";

const BOOK_ID = "book-1";

function makeCtx(id = BOOK_ID) {
  return { params: Promise.resolve({ id }) };
}

function makeReq() {
  return new NextRequest(`http://localhost/api/verification/sanitary/${BOOK_ID}/file`);
}

function mockSession(role = "ADMIN") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("GET /api/verification/sanitary/[id]/file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(dbRaw.sanitaryBook.findUnique).mockResolvedValue({
      fileUrl: "https://res.cloudinary.com/d/image/upload/v1234/sanitary.pdf",
    } as never);
  });

  it("ADMIN gets signed redirect → 302", async () => {
    const res = await GET(makeReq(), makeCtx());
    expect(res.status).toBe(302);
  });

  it("non-ADMIN → 403", async () => {
    mockSession("WAITER");
    const res = await GET(makeReq(), makeCtx());
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET(makeReq(), makeCtx());
    expect(res.status).toBe(401);
  });

  it("sanitary book not found → 404", async () => {
    vi.mocked(dbRaw.sanitaryBook.findUnique).mockResolvedValue(null);
    const res = await GET(makeReq(), makeCtx("bad-id"));
    expect(res.status).toBe(404);
  });

  it("redirect location is signed URL", async () => {
    const res = await GET(makeReq(), makeCtx());
    expect(res.headers.get("location")).toBe("https://res.cloudinary.com/signed?token=abc");
  });

  it("signCloudinaryUrl called with 3600s expiry", async () => {
    await GET(makeReq(), makeCtx());
    expect(vi.mocked(signCloudinaryUrl)).toHaveBeenCalledWith(
      expect.any(String),
      3600,
    );
  });
});
