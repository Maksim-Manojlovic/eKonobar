import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth",          () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config",  () => ({ authOptions: {} }));

// No other mocks — DB stays real.
// Unit test mocked db entirely, so:
//   - duplicate PENDING invite check (db.invite.findFirst) never ran
//   - invite row was never written to DB
//   - rate-limit counter (real RateLimit table) never incremented
//   - expiry date calculation was never validated against real clock

import { getServerSession } from "next-auth";
import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { dbRaw } from "@/lib/core/db";
import { POST, GET } from "../route";

function makePost(body: object) {
  return new NextRequest("http://localhost/api/invites", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

function makeGet() {
  return new NextRequest("http://localhost/api/invites", { method: "GET" });
}

function mockOwner(id: string) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id, role: "VENUE_OWNER" },
  } as never);
}

function mockWaiter(id: string) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id, role: "WAITER" },
  } as never);
}

async function createScaffold() {
  const ownerId  = await seedUser({ role: "VENUE_OWNER" });
  const waiterId = await seedUser({ role: "WAITER" });

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

  return { ownerId, waiterId, venueId: venue.id };
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("POST /api/invites — integration", () => {

  // ── Happy path ──────────────────────────────────────────────────────────────

  it("creates invite row in DB, 201", async () => {
    const { ownerId, waiterId } = await createScaffold();
    mockOwner(ownerId);

    const res = await POST(makePost({ waiterId }));
    expect(res.status).toBe(201);

    const invite = await dbRaw.invite.findFirst({ where: { senderId: ownerId, recipientId: waiterId } });
    expect(invite).not.toBeNull();
    expect(invite!.type).toBe("JOB_INVITE");
    expect(invite!.status).toBe("PENDING");
  });

  it("expiresAt set to ~7 days from now", async () => {
    const { ownerId, waiterId } = await createScaffold();
    mockOwner(ownerId);

    await POST(makePost({ waiterId }));

    const invite = await dbRaw.invite.findFirst({ where: { senderId: ownerId, recipientId: waiterId } });
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(invite!.expiresAt.getTime()).toBeGreaterThan(Date.now() + sevenDaysMs - 5_000);
    expect(invite!.expiresAt.getTime()).toBeLessThan(Date.now() + sevenDaysMs + 5_000);
  });

  // ── Deduplication — real DB query ───────────────────────────────────────────

  it("duplicate PENDING invite → 409 (real findFirst query)", async () => {
    const { ownerId, waiterId } = await createScaffold();
    mockOwner(ownerId);

    await POST(makePost({ waiterId }));               // first — creates
    const res = await POST(makePost({ waiterId }));   // second — duplicate
    expect(res.status).toBe(409);

    // Only one invite in DB
    const rows = await dbRaw.invite.findMany({ where: { senderId: ownerId, recipientId: waiterId } });
    expect(rows).toHaveLength(1);
  });

  it("dedup only blocks PENDING — ACCEPTED duplicate allowed", async () => {
    const { ownerId, waiterId } = await createScaffold();

    // Create an ACCEPTED invite manually
    await dbRaw.invite.create({
      data: {
        senderId:    ownerId,
        recipientId: waiterId,
        type:        "JOB_INVITE",
        status:      "ACCEPTED",
        expiresAt:   new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    mockOwner(ownerId);
    const res = await POST(makePost({ waiterId }));
    expect(res.status).toBe(201); // new PENDING invite allowed

    const rows = await dbRaw.invite.findMany({ where: { senderId: ownerId, recipientId: waiterId } });
    expect(rows).toHaveLength(2); // ACCEPTED + new PENDING
  });

  it("different sender same waiter — no 409 (invites are per sender)", async () => {
    const { waiterId } = await createScaffold();
    const owner2Id = await seedUser({ role: "VENUE_OWNER" });
    await dbRaw.venue.create({
      data: { ownerId: owner2Id, name: "V2", address: "A", municipality: "B", venueType: "CAFE", latitude: 44.8, longitude: 20.4 },
    });

    // Owner 1 invites waiter
    const { ownerId } = await createScaffold();
    mockOwner(ownerId);
    await POST(makePost({ waiterId }));

    // Owner 2 invites same waiter — different sender, should be allowed
    mockOwner(owner2Id);
    const res = await POST(makePost({ waiterId }));
    expect(res.status).toBe(201);
  });

  // ── Resource guards ─────────────────────────────────────────────────────────

  it("nonexistent waiter → 404", async () => {
    const { ownerId } = await createScaffold();
    mockOwner(ownerId);
    const res = await POST(makePost({ waiterId: "ghost-id" }));
    expect(res.status).toBe(404);
  });

  it("rate limit: 21st invite → 429 (real RateLimit counter)", async () => {
    const { ownerId } = await createScaffold();
    mockOwner(ownerId);

    // 20 invites to 20 different waiters (limit = 20/hour)
    for (let i = 0; i < 20; i++) {
      const wId = await seedUser({ role: "WAITER" });
      await POST(makePost({ waiterId: wId }));
    }

    const extraWaiter = await seedUser({ role: "WAITER" });
    const res = await POST(makePost({ waiterId: extraWaiter }));
    expect(res.status).toBe(429);
  });
});

describe("GET /api/invites — integration", () => {
  it("VENUE_OWNER gets sent invites", async () => {
    const { ownerId, waiterId } = await createScaffold();
    await dbRaw.invite.create({
      data: {
        senderId:    ownerId,
        recipientId: waiterId,
        type:        "JOB_INVITE",
        status:      "PENDING",
        expiresAt:   new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    mockOwner(ownerId);

    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].recipientId).toBe(waiterId);
  });

  it("WAITER gets received invites", async () => {
    const { ownerId, waiterId } = await createScaffold();
    await dbRaw.invite.create({
      data: {
        senderId:    ownerId,
        recipientId: waiterId,
        type:        "JOB_INVITE",
        status:      "PENDING",
        expiresAt:   new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    mockWaiter(waiterId);

    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].senderId).toBe(ownerId);
  });
});
