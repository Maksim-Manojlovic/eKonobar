import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth",          () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config",  () => ({ authOptions: {} }));

// Unit test mocked db entirely — upsert semantics (re-save updates notes,
// create on first save), deleteMany scoping, and GET enrichment join
// (savedProfile → user → waiterPassport) were never executed.

import { getServerSession } from "next-auth";
import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { dbRaw } from "@/lib/core/db";
import { GET, POST, DELETE } from "../route";

const CTX = { params: Promise.resolve({}) };

function mockHH(id: string) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id, role: "HEADHUNTER" },
  } as never);
}

function makePost(body: object) {
  return new NextRequest("http://localhost/api/headhunter/saved", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

function makeDelete(body: object) {
  return new NextRequest("http://localhost/api/headhunter/saved", {
    method:  "DELETE",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

function makeGet() {
  return new NextRequest("http://localhost/api/headhunter/saved", { method: "GET" });
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("Headhunter saved profiles — integration", () => {
  let hhId: string;
  let waiterId: string;

  beforeEach(async () => {
    hhId      = await seedUser({ role: "HEADHUNTER" });
    waiterId  = await seedUser({ role: "WAITER" });
    await dbRaw.waiterPassport.create({ data: { userId: waiterId } });
    mockHH(hhId);
  });

  // ── POST — upsert ──────────────────────────────────────────────────────────

  it("first save: creates SavedProfile row", async () => {
    const res = await POST(makePost({ waiterId, notes: "Great candidate" }), CTX);
    expect(res.status).toBe(201);

    const row = await dbRaw.savedProfile.findUnique({
      where: { headhunterId_savedWaiterId: { headhunterId: hhId, savedWaiterId: waiterId } },
    });
    expect(row).not.toBeNull();
    expect(row!.notes).toBe("Great candidate");
  });

  it("re-save: upsert updates notes, no duplicate row", async () => {
    await POST(makePost({ waiterId, notes: "Initial note" }), CTX);
    const res = await POST(makePost({ waiterId, notes: "Updated note" }), CTX);
    expect(res.status).toBe(201);

    const rows = await dbRaw.savedProfile.findMany({
      where: { headhunterId: hhId, savedWaiterId: waiterId },
    });
    expect(rows).toHaveLength(1);        // upsert, not duplicate
    expect(rows[0].notes).toBe("Updated note");
  });

  it("re-save with null notes clears previous notes", async () => {
    await POST(makePost({ waiterId, notes: "Old note" }), CTX);
    await POST(makePost({ waiterId }), CTX);   // no notes field

    const row = await dbRaw.savedProfile.findUnique({
      where: { headhunterId_savedWaiterId: { headhunterId: hhId, savedWaiterId: waiterId } },
    });
    expect(row!.notes).toBeNull();
  });

  it("nonexistent waiter → 404", async () => {
    const res = await POST(makePost({ waiterId: "ghost-id" }), CTX);
    expect(res.status).toBe(404);
  });

  // ── DELETE ─────────────────────────────────────────────────────────────────

  it("delete removes SavedProfile row", async () => {
    await POST(makePost({ waiterId }), CTX);

    const res = await DELETE(makeDelete({ waiterId }), CTX);
    expect(res.status).toBe(200);

    const row = await dbRaw.savedProfile.findUnique({
      where: { headhunterId_savedWaiterId: { headhunterId: hhId, savedWaiterId: waiterId } },
    });
    expect(row).toBeNull();
  });

  it("delete nonexistent profile is a no-op (deleteMany idempotent)", async () => {
    const res = await DELETE(makeDelete({ waiterId }), CTX);
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(true);
  });

  it("delete scoped to headhunter — does not delete other HH's save", async () => {
    const hh2 = await seedUser({ role: "HEADHUNTER" });
    // hh2 saves the same waiter
    await dbRaw.savedProfile.create({
      data: { headhunterId: hh2, savedWaiterId: waiterId },
    });

    // hhId saves and then deletes
    await POST(makePost({ waiterId }), CTX);
    await DELETE(makeDelete({ waiterId }), CTX);

    // hh2's save must still exist
    const row = await dbRaw.savedProfile.findUnique({
      where: { headhunterId_savedWaiterId: { headhunterId: hh2, savedWaiterId: waiterId } },
    });
    expect(row).not.toBeNull();
  });

  // ── GET — enrichment join ─────────────────────────────────────────────────

  it("GET returns enriched list with waiter data", async () => {
    await POST(makePost({ waiterId, notes: "Top pick" }), CTX);

    const res = await GET(makeGet(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].notes).toBe("Top pick");
    expect(body[0].waiter).not.toBeNull();
    expect(body[0].waiter.id).toBe(waiterId);
    expect(body[0].waiter.waiterPassport).not.toBeNull();
  });

  it("GET excludes saves for deleted waiters from results", async () => {
    await POST(makePost({ waiterId }), CTX);
    // Soft-delete the waiter
    await dbRaw.user.update({ where: { id: waiterId }, data: { deletedAt: new Date() } });

    const { length } = await (await GET(makeGet(), CTX)).json();
    // db.user.findMany with deletedAt:null filter excludes the deleted waiter
    // so waiterMap.get returns undefined → filtered out
    expect(length).toBe(0);
  });

  it("GET returns multiple saves ordered by savedAt desc", async () => {
    const waiter2 = await seedUser({ role: "WAITER" });
    await dbRaw.waiterPassport.create({ data: { userId: waiter2 } });

    await POST(makePost({ waiterId,  notes: "First" }), CTX);
    await POST(makePost({ waiterId: waiter2, notes: "Second" }), CTX);

    const body = await (await GET(makeGet(), CTX)).json();
    expect(body).toHaveLength(2);
    // Most recently saved (waiter2) comes first
    expect(body[0].waiter.id).toBe(waiter2);
    expect(body[1].waiter.id).toBe(waiterId);
  });
});
