import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { db, dbRaw } from "@/lib/core/db";

// Tests for the Prisma $extends() soft-delete filter in lib/core/db.ts.
// The extension injects `deletedAt: null` into findUnique/findFirst/findMany
// for User, Venue, and JobPost.  This behaviour is invisible to unit tests
// because every mock replaces db with { findUnique: vi.fn() }.
//
// Key claims verified:
//   - db.* never returns rows where deletedAt IS NOT NULL
//   - dbRaw.* bypasses the filter (used by admin + score-sync)
//   - findUnique with added non-unique field does not throw
//     (Prisma converts it to findFirst internally)
//   - caller-supplied where conditions compose correctly with the injected filter

const DELETED = new Date();

beforeEach(async () => {
  await resetDb();
});

// ── User ──────────────────────────────────────────────────────────────────────

describe("db soft-delete — User", () => {
  it("findUnique: non-deleted user returned", async () => {
    const u = await dbRaw.user.create({ data: { email: "live@t.local", name: "Live" } });
    const result = await db.user.findUnique({ where: { id: u.id } });
    expect(result).not.toBeNull();
    expect(result!.id).toBe(u.id);
  });

  it("findUnique: deleted user → null", async () => {
    const u = await dbRaw.user.create({ data: { email: "del@t.local", name: "Del", deletedAt: DELETED } });
    expect(await db.user.findUnique({ where: { id: u.id } })).toBeNull();
  });

  it("findFirst: deleted user → null even with matching email", async () => {
    await dbRaw.user.create({ data: { email: "gone@t.local", name: "Gone", deletedAt: DELETED } });
    expect(await db.user.findFirst({ where: { email: "gone@t.local" } })).toBeNull();
  });

  it("findFirst: non-deleted user found by email", async () => {
    await dbRaw.user.create({ data: { email: "here@t.local", name: "Here" } });
    expect(await db.user.findFirst({ where: { email: "here@t.local" } })).not.toBeNull();
  });

  it("findMany: excludes deleted, includes live", async () => {
    await dbRaw.user.createMany({
      data: [
        { email: "a@t.local", name: "A" },
        { email: "b@t.local", name: "B" },
        { email: "c@t.local", name: "C", deletedAt: DELETED },
      ],
    });
    const results = await db.user.findMany();
    const emails = results.map(u => u.email);
    expect(emails).toContain("a@t.local");
    expect(emails).toContain("b@t.local");
    expect(emails).not.toContain("c@t.local");
  });

  it("findMany: additional caller where clause composes with deletedAt filter", async () => {
    await dbRaw.user.createMany({
      data: [
        { email: "w1@t.local", name: "W1", role: "WAITER" },
        { email: "w2@t.local", name: "W2", role: "WAITER",   deletedAt: DELETED },
        { email: "o1@t.local", name: "O1", role: "VENUE_OWNER" },
      ],
    });
    const waiters = await db.user.findMany({ where: { role: "WAITER" } });
    expect(waiters).toHaveLength(1);
    expect(waiters[0].email).toBe("w1@t.local");
  });

  it("dbRaw bypasses filter — deleted user visible", async () => {
    const u = await dbRaw.user.create({ data: { email: "raw@t.local", name: "Raw", deletedAt: DELETED } });
    // db hides it
    expect(await db.user.findUnique({ where: { id: u.id } })).toBeNull();
    // dbRaw sees it
    const raw = await dbRaw.user.findUnique({ where: { id: u.id } });
    expect(raw).not.toBeNull();
    expect(raw!.deletedAt).not.toBeNull();
  });

  it("update on deleted user via dbRaw still works (admin restore path)", async () => {
    const u = await dbRaw.user.create({ data: { email: "restore@t.local", name: "R", deletedAt: DELETED } });
    // Admin sets deletedAt = null to restore the user
    await dbRaw.user.update({ where: { id: u.id }, data: { deletedAt: null } });
    // Now db (filtered) can see the user again
    expect(await db.user.findUnique({ where: { id: u.id } })).not.toBeNull();
  });
});

// ── Venue ─────────────────────────────────────────────────────────────────────

describe("db soft-delete — Venue", () => {
  let ownerId: string;

  beforeEach(async () => {
    ownerId = await seedUser({ role: "VENUE_OWNER" });
  });

  async function createVenue(name: string, opts: { deleted?: boolean } = {}) {
    return dbRaw.venue.create({
      data: {
        ownerId,
        name,
        address:      "Test Street",
        municipality: "Beograd",
        venueType:    "RESTAURANT",
        latitude:     44.8,
        longitude:    20.4,
        ...(opts.deleted ? { deletedAt: DELETED } : {}),
      },
    });
  }

  it("findUnique: deleted venue → null", async () => {
    const v = await createVenue("Del Venue", { deleted: true });
    expect(await db.venue.findUnique({ where: { id: v.id } })).toBeNull();
  });

  it("findUnique: live venue returned", async () => {
    const v = await createVenue("Live Venue");
    expect(await db.venue.findUnique({ where: { id: v.id } })).not.toBeNull();
  });

  it("findFirst: deleted venue invisible", async () => {
    const v = await createVenue("Invisible", { deleted: true });
    expect(await db.venue.findFirst({ where: { id: v.id } })).toBeNull();
  });

  it("findMany: mix of live/deleted — only live returned", async () => {
    await createVenue("Open");
    await createVenue("Closed", { deleted: true });
    const results = await db.venue.findMany({ where: { ownerId } });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Open");
  });

  it("dbRaw sees deleted venue; db does not", async () => {
    const v = await createVenue("Ghost", { deleted: true });
    expect(await db.venue.findUnique({ where: { id: v.id } })).toBeNull();
    expect(await dbRaw.venue.findUnique({ where: { id: v.id } })).not.toBeNull();
  });
});

// ── JobPost ───────────────────────────────────────────────────────────────────

describe("db soft-delete — JobPost", () => {
  let ownerId: string;
  let venueId: string;

  beforeEach(async () => {
    ownerId  = await seedUser({ role: "VENUE_OWNER" });
    const v  = await dbRaw.venue.create({
      data: {
        ownerId,
        name:         "Venue",
        address:      "Addr",
        municipality: "Beograd",
        venueType:    "CAFE",
        latitude:     44.8,
        longitude:    20.4,
      },
    });
    venueId = v.id;
  });

  async function createPost(title: string, opts: { deleted?: boolean } = {}) {
    return dbRaw.jobPost.create({
      data: {
        venueId,
        ownerId,
        title,
        description:    "...",
        engagementType: "FULL_TIME",
        tipSystem:      "INDIVIDUAL",
        ...(opts.deleted ? { deletedAt: DELETED } : {}),
      },
    });
  }

  it("findUnique: deleted post → null", async () => {
    const p = await createPost("Del Post", { deleted: true });
    expect(await db.jobPost.findUnique({ where: { id: p.id } })).toBeNull();
  });

  it("findUnique: live post returned", async () => {
    const p = await createPost("Live Post");
    expect(await db.jobPost.findUnique({ where: { id: p.id } })).not.toBeNull();
  });

  it("findMany: deleted posts excluded from venue listing", async () => {
    await createPost("Active");
    await createPost("Paused", { deleted: true });
    const results = await db.jobPost.findMany({ where: { venueId } });
    expect(results.map(p => p.title)).toContain("Active");
    expect(results.map(p => p.title)).not.toContain("Paused");
  });

  it("dbRaw sees deleted post for score-sync and admin use", async () => {
    const p = await createPost("Hidden", { deleted: true });
    expect(await db.jobPost.findUnique({ where: { id: p.id } })).toBeNull();
    expect(await dbRaw.jobPost.findUnique({ where: { id: p.id } })).not.toBeNull();
  });
});
