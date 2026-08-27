import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth",           () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config",   () => ({ authOptions: {} }));
vi.mock("@/lib/notifications/side-effects", () => ({ fireSideEffects: vi.fn() }));

// DB stays real — the unit test mocked dbRaw.$transaction, so
// EngagementRecord creation and totalEngagements increment were never
// actually executed. This test proves the COMPLETED $transaction commits
// both writes atomically, and that the state machine enforces valid transitions.

import { getServerSession } from "next-auth";
import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { dbRaw } from "@/lib/core/db";
import { PATCH } from "../route";

// ── Test helpers ──────────────────────────────────────────────────────────────

function mockSession(id: string, role = "VENUE_OWNER") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/jobs/applications/x", {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function createScaffold() {
  const ownerId  = await seedUser({ role: "VENUE_OWNER" });
  const waiterId = await seedUser({ role: "WAITER" });

  await dbRaw.waiterPassport.create({ data: { userId: waiterId } });

  const venue = await dbRaw.venue.create({
    data: {
      ownerId,
      name:         "Venue",
      address:      "Addr",
      municipality: "Beograd",
      venueType:    "RESTAURANT",
      latitude:     44.8,
      longitude:    20.4,
    },
  });

  const post = await dbRaw.jobPost.create({
    data: {
      venueId:        venue.id,
      ownerId,
      title:          "Waiter position",
      description:    "...",
      engagementType: "FULL_TIME",
      tipSystem:      "INDIVIDUAL",
    },
  });

  const app = await dbRaw.jobApplication.create({
    data: { jobPostId: post.id, waiterId, status: "PENDING" },
  });

  return { ownerId, waiterId, venueId: venue.id, postId: post.id, appId: app.id };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("PATCH /api/jobs/applications/[id] — integration", () => {

  // ── Resource guards ─────────────────────────────────────────────────────────

  it("nonexistent application → 404", async () => {
    const { ownerId } = await createScaffold();
    mockSession(ownerId);
    const res = await PATCH(makeReq({ status: "ACCEPTED" }), makeCtx("nonexistent-id"));
    expect(res.status).toBe(404);
  });

  it("unrelated user (not owner, not waiter) → 403", async () => {
    const { appId } = await createScaffold();
    const intruderId = await seedUser({ role: "VENUE_OWNER" });
    mockSession(intruderId);
    const res = await PATCH(makeReq({ status: "ACCEPTED" }), makeCtx(appId));
    expect(res.status).toBe(403);
  });

  // ── State machine — owner transitions ───────────────────────────────────────

  it("owner: PENDING → SHORTLISTED succeeds", async () => {
    const { ownerId, appId } = await createScaffold();
    mockSession(ownerId);
    const res = await PATCH(makeReq({ status: "SHORTLISTED" }), makeCtx(appId));
    expect(res.status).toBe(200);
    const app = await dbRaw.jobApplication.findUnique({ where: { id: appId } });
    expect(app!.status).toBe("SHORTLISTED");
  });

  it("owner: PENDING → ACCEPTED succeeds", async () => {
    const { ownerId, appId } = await createScaffold();
    mockSession(ownerId);
    const res = await PATCH(makeReq({ status: "ACCEPTED" }), makeCtx(appId));
    expect(res.status).toBe(200);
  });

  it("owner: PENDING → COMPLETED is invalid → 400", async () => {
    const { ownerId, appId } = await createScaffold();
    mockSession(ownerId);
    const res = await PATCH(makeReq({ status: "COMPLETED" }), makeCtx(appId));
    expect(res.status).toBe(400);
    // DB untouched
    const app = await dbRaw.jobApplication.findUnique({ where: { id: appId } });
    expect(app!.status).toBe("PENDING");
  });

  it("owner: ACCEPTED → COMPLETED succeeds + $transaction runs", async () => {
    const { ownerId, waiterId, venueId, postId, appId } = await createScaffold();
    // Advance to ACCEPTED first
    await dbRaw.jobApplication.update({ where: { id: appId }, data: { status: "ACCEPTED" } });
    mockSession(ownerId);

    const res = await PATCH(makeReq({ status: "COMPLETED" }), makeCtx(appId));
    expect(res.status).toBe(200);

    // EngagementRecord created (the $transaction write that was always mocked)
    const record = await dbRaw.engagementRecord.findFirst({ where: { waiterId, venueId } });
    expect(record).not.toBeNull();
    expect(record!.jobPostId).toBe(postId);
    expect(record!.verified).toBe(true);
    expect(record!.verifiedAt).not.toBeNull();

    // WaiterPassport.totalEngagements incremented
    const passport = await dbRaw.waiterPassport.findUnique({ where: { userId: waiterId } });
    expect(passport!.totalEngagements).toBe(1);
  });

  it("COMPLETED $transaction is atomic: both EngagementRecord and passport updated", async () => {
    const { ownerId, waiterId, venueId, appId } = await createScaffold();
    await dbRaw.waiterPassport.update({
      where: { userId: waiterId },
      data:  { totalEngagements: 4 },
    });
    await dbRaw.jobApplication.update({ where: { id: appId }, data: { status: "ACCEPTED" } });
    mockSession(ownerId);

    await PATCH(makeReq({ status: "COMPLETED" }), makeCtx(appId));

    const passport = await dbRaw.waiterPassport.findUnique({ where: { userId: waiterId } });
    expect(passport!.totalEngagements).toBe(5); // 4 + 1

    const engCount = await dbRaw.engagementRecord.count({ where: { venueId, waiterId } });
    expect(engCount).toBe(1);
  });

  it("owner: SHORTLISTED → REJECTED succeeds", async () => {
    const { ownerId, appId } = await createScaffold();
    await dbRaw.jobApplication.update({ where: { id: appId }, data: { status: "SHORTLISTED" } });
    mockSession(ownerId);
    const res = await PATCH(makeReq({ status: "REJECTED" }), makeCtx(appId));
    expect(res.status).toBe(200);
    const app = await dbRaw.jobApplication.findUnique({ where: { id: appId } });
    expect(app!.status).toBe("REJECTED");
  });

  // ── State machine — waiter transitions ──────────────────────────────────────

  it("waiter: PENDING → WITHDRAWN succeeds", async () => {
    const { waiterId, appId } = await createScaffold();
    mockSession(waiterId, "WAITER");
    const res = await PATCH(makeReq({ status: "WITHDRAWN" }), makeCtx(appId));
    expect(res.status).toBe(200);
    const app = await dbRaw.jobApplication.findUnique({ where: { id: appId } });
    expect(app!.status).toBe("WITHDRAWN");
  });

  it("waiter: PENDING → ACCEPTED is invalid → 400", async () => {
    const { waiterId, appId } = await createScaffold();
    mockSession(waiterId, "WAITER");
    const res = await PATCH(makeReq({ status: "ACCEPTED" }), makeCtx(appId));
    expect(res.status).toBe(400);
  });

  it("waiter: ACCEPTED → WITHDRAWN is invalid → 400", async () => {
    const { waiterId, appId } = await createScaffold();
    await dbRaw.jobApplication.update({ where: { id: appId }, data: { status: "ACCEPTED" } });
    mockSession(waiterId, "WAITER");
    const res = await PATCH(makeReq({ status: "WITHDRAWN" }), makeCtx(appId));
    expect(res.status).toBe(400);
  });

  it("waiter cannot mark COMPLETED — even on ACCEPTED app", async () => {
    const { waiterId, appId } = await createScaffold();
    await dbRaw.jobApplication.update({ where: { id: appId }, data: { status: "ACCEPTED" } });
    mockSession(waiterId, "WAITER");
    const res = await PATCH(makeReq({ status: "COMPLETED" }), makeCtx(appId));
    expect(res.status).toBe(400);
  });

  // ── Invalid enum value ──────────────────────────────────────────────────────

  it("invalid status string → 400 validation error", async () => {
    const { ownerId, appId } = await createScaffold();
    mockSession(ownerId);
    const res = await PATCH(makeReq({ status: "MAGIC" }), makeCtx(appId));
    expect(res.status).toBe(400);
  });
});
