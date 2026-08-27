import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    waiterPassport: { findUnique: vi.fn(), upsert: vi.fn() },
    review:         { findMany: vi.fn() },
    user:           { update: vi.fn() },
  },
}));
vi.mock("@/lib/core/logger", () => ({ default: { error: vi.fn() } }));

import { db } from "@/lib/core/db";
import {
  getReq, putReq, CTX, mockSession as harnessSession, mockNoSession,
} from "@/tests/unit/route-harness";
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

// The harness takes the role first with no default; every call here is a waiter
// unless it says otherwise.
const mockSession = (role = "WAITER", id = WAITER_ID) => harnessSession(role, id);

describe("GET /api/passport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue(BASE_PASSPORT as never);
    vi.mocked(db.review.findMany).mockResolvedValue([]);
  });

  it("WAITER gets passport + recentReviews", async () => {
    mockSession();

    const res = await GET(getReq(), CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("pp-1");
    expect(json.recentReviews).toEqual([]);
  });

  it("WAITER with no passport → returns null body", async () => {
    mockSession();
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue(null);

    const res = await GET(getReq(), CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toBeNull();
  });

  it("VENUE_OWNER → 403", async () => {
    mockSession("VENUE_OWNER", "owner-1");
    const res = await GET(getReq(), CTX);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET(getReq(), CTX);
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
    const res = await PUT(putReq({ bio: "Updated bio" }), CTX);
    expect(res.status).toBe(200);
    expect(vi.mocked(db.waiterPassport.upsert)).toHaveBeenCalledOnce();
  });

  it("VENUE_OWNER → 403", async () => {
    mockSession("VENUE_OWNER", "owner-1");
    const res = await PUT(putReq({ bio: "x" }), CTX);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await PUT(putReq({ bio: "x" }), CTX);
    expect(res.status).toBe(401);
  });

  it("profilePhoto triggers user.image sync", async () => {
    const PHOTO_URL = "https://res.cloudinary.com/test/image/upload/v1/avatar.jpg";
    await PUT(putReq({ profilePhoto: PHOTO_URL }), CTX);

    expect(vi.mocked(db.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { image: PHOTO_URL } }),
    );
  });

  it("no profilePhoto key → user.update not called", async () => {
    await PUT(putReq({ bio: "no photo" }), CTX);
    expect(vi.mocked(db.user.update)).not.toHaveBeenCalled();
  });

  it("profilePhoto: null clears User.image too", async () => {
    await PUT(putReq({ profilePhoto: null }), CTX);

    // Guarding on truthiness here left User.image pointing at the removed photo,
    // so every avatar drawn from it kept showing an image the waiter had deleted.
    expect(vi.mocked(db.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { image: null } }),
    );
  });

  it("workMunicipalities sanitized — junk dropped, canonical order kept", async () => {
    await PUT(putReq({ workMunicipalities: ["Zemun", "Atlantis", "Vračar"] }), CTX);

    const upsertCall = vi.mocked(db.waiterPassport.upsert).mock.calls[0][0] as {
      create: { workMunicipalities: string[] };
      update: { workMunicipalities?: string[] };
    };
    // Atlantis dropped; Vračar (canonical idx 1) before Zemun (idx 9).
    expect(upsertCall.create.workMunicipalities).toEqual(["Vračar", "Zemun"]);
    expect(upsertCall.update.workMunicipalities).toEqual(["Vračar", "Zemun"]);
  });

  it("workMunicipalities omitted → not written on update", async () => {
    await PUT(putReq({ bio: "no reach change" }), CTX);

    const upsertCall = vi.mocked(db.waiterPassport.upsert).mock.calls[0][0] as {
      update: Record<string, unknown>;
    };
    expect(upsertCall.update).not.toHaveProperty("workMunicipalities");
  });

  it("galleryPhotos capped at 4", async () => {
    const photos = Array(6).fill("https://img.test/photo.jpg");
    await PUT(putReq({ galleryPhotos: photos }), CTX);

    const upsertCall = vi.mocked(db.waiterPassport.upsert).mock.calls[0][0] as {
      create: { galleryPhotos: string[] };
    };
    expect(upsertCall.create.galleryPhotos).toHaveLength(4);
  });

  it("currentlyAvailable=true on previously-false passport sets lastAvailableDate", async () => {
    await PUT(putReq({ currentlyAvailable: true }), CTX);

    const upsertCall = vi.mocked(db.waiterPassport.upsert).mock.calls[0][0] as {
      update: Record<string, unknown>;
    };
    expect(upsertCall.update).toHaveProperty("lastAvailableDate");
  });

  it("currentlyAvailable=false clears lastAvailableDate", async () => {
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue({
      currentlyAvailable: true,
    } as never);

    await PUT(putReq({ currentlyAvailable: false }), CTX);

    const upsertCall = vi.mocked(db.waiterPassport.upsert).mock.calls[0][0] as {
      update: Record<string, unknown>;
    };
    expect(upsertCall.update.lastAvailableDate).toBeNull();
  });
});
