import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    waiterPassport: { findUnique: vi.fn(), upsert: vi.fn() },
    review:         { findMany: vi.fn() },
    user:           { update: vi.fn() },
  },
}));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn() } }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { GET, PUT } from "../route";

const WAITER_ID = "waiter-1";

const BASE_PASSPORT = {
  id: "pp-1",
  userId: WAITER_ID,
  bio: "Experienced waiter",
  skills: ["coffee", "wine"],
  languages: ["sr", "en"],
  yearsExperience: 3,
  currentlyAvailable: true,
  trustScore: null,
};

function makePutReq(body: object) {
  return new NextRequest("http://localhost/api/passport", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(role = "WAITER", id = WAITER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("GET /api/passport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue(BASE_PASSPORT as never);
    vi.mocked(db.review.findMany).mockResolvedValue([]);
  });

  it("WAITER gets passport + recentReviews", async () => {
    mockSession();

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("pp-1");
    expect(json.recentReviews).toEqual([]);
  });

  it("WAITER with no passport → returns null body", async () => {
    mockSession();
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toBeNull();
  });

  it("VENUE_OWNER → 403", async () => {
    mockSession("VENUE_OWNER", "owner-1");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/passport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue({
      currentlyAvailable: false,
    } as never);
    vi.mocked(db.waiterPassport.upsert).mockResolvedValue(BASE_PASSPORT as never);
    vi.mocked(db.user.update).mockResolvedValue({} as never);
  });

  it("WAITER upserts passport → 200", async () => {
    const res = await PUT(makePutReq({ bio: "Updated bio" }));
    expect(res.status).toBe(200);
    expect(vi.mocked(db.waiterPassport.upsert)).toHaveBeenCalledOnce();
  });

  it("VENUE_OWNER → 403", async () => {
    mockSession("VENUE_OWNER", "owner-1");
    const res = await PUT(makePutReq({ bio: "x" }));
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await PUT(makePutReq({ bio: "x" }));
    expect(res.status).toBe(401);
  });

  it("profilePhoto triggers user.image sync", async () => {
    const PHOTO_URL = "https://res.cloudinary.com/test/image/upload/v1/avatar.jpg";
    await PUT(makePutReq({ profilePhoto: PHOTO_URL }));

    expect(vi.mocked(db.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { image: PHOTO_URL } }),
    );
  });

  it("no profilePhoto → user.update not called", async () => {
    await PUT(makePutReq({ bio: "no photo" }));
    expect(vi.mocked(db.user.update)).not.toHaveBeenCalled();
  });

  it("galleryPhotos capped at 4", async () => {
    const photos = Array(6).fill("https://img.test/photo.jpg");
    await PUT(makePutReq({ galleryPhotos: photos }));

    const upsertCall = vi.mocked(db.waiterPassport.upsert).mock.calls[0][0] as {
      create: { galleryPhotos: string[] };
    };
    expect(upsertCall.create.galleryPhotos).toHaveLength(4);
  });

  it("currentlyAvailable=true on previously-false passport sets lastAvailableDate", async () => {
    await PUT(makePutReq({ currentlyAvailable: true }));

    const upsertCall = vi.mocked(db.waiterPassport.upsert).mock.calls[0][0] as {
      update: Record<string, unknown>;
    };
    expect(upsertCall.update).toHaveProperty("lastAvailableDate");
  });

  it("currentlyAvailable=false clears lastAvailableDate", async () => {
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue({
      currentlyAvailable: true,
    } as never);

    await PUT(makePutReq({ currentlyAvailable: false }));

    const upsertCall = vi.mocked(db.waiterPassport.upsert).mock.calls[0][0] as {
      update: Record<string, unknown>;
    };
    expect(upsertCall.update.lastAvailableDate).toBeNull();
  });
});
