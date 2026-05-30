import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth",          () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config",  () => ({ authOptions: {} }));

// Unit test mocked db.user entirely — DB-level sort (tierRank desc, score desc),
// filter correctness, and soft-delete exclusion were never executed.
// This test also covers the filterering that collapses into a Prisma WHERE clause.

import { getServerSession } from "next-auth";
import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { dbRaw } from "@/lib/core/db";
import { GET } from "../route";

const CTX = { params: Promise.resolve({}) };
const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

function makeReq(qs = "") {
  return new NextRequest(`http://localhost/api/waiters${qs ? `?${qs}` : ""}`, { method: "GET" });
}

function mockOwner(id: string) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id, role: "VENUE_OWNER" },
  } as never);
}

async function createWaiter(opts: {
  name?:              string;
  score?:             number;
  tierRank?:          number;
  passportTier?:      "FREE" | "PRO" | "PRO_PLUS";
  subscriptionExpiresAt?: Date | null;
  available?:         boolean;
  sanitaryBookValid?: boolean;
  yearsExperience?:   number;
  skills?:            string[];
  languages?:         string[];
  verificationTier?:  "UNVERIFIED" | "SILVER" | "GOLD" | "ID_VERIFIED";
  deletedAt?:         Date;
}) {
  const userId = await seedUser({ role: "WAITER", name: opts.name ?? "Test Waiter" });

  if (opts.verificationTier && opts.verificationTier !== "UNVERIFIED") {
    await dbRaw.user.update({ where: { id: userId }, data: { verificationTier: opts.verificationTier } });
  }
  if (opts.deletedAt) {
    await dbRaw.user.update({ where: { id: userId }, data: { deletedAt: opts.deletedAt } });
  }

  await dbRaw.waiterPassport.create({
    data: {
      userId,
      score:                opts.score                ?? 50,
      tierRank:             opts.tierRank             ?? 0,
      passportTier:         opts.passportTier         ?? "FREE",
      subscriptionExpiresAt: opts.subscriptionExpiresAt ?? null,
      currentlyAvailable:   opts.available            ?? true,
      sanitaryBookValid:    opts.sanitaryBookValid     ?? false,
      yearsExperience:      opts.yearsExperience       ?? 0,
      skills:               opts.skills               ?? [],
      languages:            opts.languages            ?? [],
    },
  });
  return userId;
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("GET /api/waiters — integration", () => {
  let ownerId: string;

  beforeEach(async () => {
    ownerId = await seedUser({ role: "VENUE_OWNER" });
    mockOwner(ownerId);
  });

  // ── Sort order ──────────────────────────────────────────────────────────────

  it("sorted by tierRank desc then score desc: PRO_PLUS > PRO > FREE regardless of score", async () => {
    const free    = await createWaiter({ name: "Free",    score: 90, tierRank: 0, passportTier: "FREE" });
    const pro     = await createWaiter({ name: "Pro",     score: 50, tierRank: 1, passportTier: "PRO",     subscriptionExpiresAt: FUTURE });
    const proPlus = await createWaiter({ name: "ProPlus", score: 30, tierRank: 2, passportTier: "PRO_PLUS", subscriptionExpiresAt: FUTURE });

    const res = await GET(makeReq(), CTX);
    const { waiters } = await res.json();

    const ids = waiters.map((w: { id: string }) => w.id);
    expect(ids.indexOf(proPlus)).toBeLessThan(ids.indexOf(pro));  // PRO_PLUS before PRO
    expect(ids.indexOf(pro)).toBeLessThan(ids.indexOf(free));     // PRO before FREE
  });

  it("within same tier, higher score appears first", async () => {
    const low  = await createWaiter({ name: "Low",  score: 30, tierRank: 0 });
    const high = await createWaiter({ name: "High", score: 80, tierRank: 0 });
    const mid  = await createWaiter({ name: "Mid",  score: 55, tierRank: 0 });

    const { waiters } = await (await GET(makeReq(), CTX)).json();
    const ids = waiters.map((w: { id: string }) => w.id);
    expect(ids.indexOf(high)).toBeLessThan(ids.indexOf(mid));
    expect(ids.indexOf(mid)).toBeLessThan(ids.indexOf(low));
  });

  // ── Filters ─────────────────────────────────────────────────────────────────

  it("available=true only returns currentlyAvailable waiters", async () => {
    const avail    = await createWaiter({ name: "Available", available: true });
    const notAvail = await createWaiter({ name: "Busy",      available: false });

    const { waiters } = await (await GET(makeReq("available=true"), CTX)).json();
    const ids = waiters.map((w: { id: string }) => w.id);
    expect(ids).toContain(avail);
    expect(ids).not.toContain(notAvail);
  });

  it("minScore=70 excludes waiters below threshold", async () => {
    const above = await createWaiter({ name: "Above", score: 80 });
    const below = await createWaiter({ name: "Below", score: 60 });

    const { waiters } = await (await GET(makeReq("minScore=70"), CTX)).json();
    const ids = waiters.map((w: { id: string }) => w.id);
    expect(ids).toContain(above);
    expect(ids).not.toContain(below);
  });

  it("sanitaryBook=true only returns verified sanitaryBook waiters", async () => {
    const withBook    = await createWaiter({ name: "Has Book",  sanitaryBookValid: true });
    const withoutBook = await createWaiter({ name: "No Book",   sanitaryBookValid: false });

    const { waiters } = await (await GET(makeReq("sanitaryBook=true"), CTX)).json();
    const ids = waiters.map((w: { id: string }) => w.id);
    expect(ids).toContain(withBook);
    expect(ids).not.toContain(withoutBook);
  });

  it("skills=cocktail filters by passport.skills hasSome", async () => {
    const barman  = await createWaiter({ name: "Barman",  skills: ["cocktail", "wine"] });
    const regular = await createWaiter({ name: "Regular", skills: ["coffee"] });

    const { waiters } = await (await GET(makeReq("skills=cocktail"), CTX)).json();
    const ids = waiters.map((w: { id: string }) => w.id);
    expect(ids).toContain(barman);
    expect(ids).not.toContain(regular);
  });

  it("search= is case-insensitive name match", async () => {
    const marko = await createWaiter({ name: "Marko Petrović" });
    await createWaiter({ name: "Nikola Jovanović" });

    const { waiters } = await (await GET(makeReq("search=marko"), CTX)).json();
    const ids = waiters.map((w: { id: string }) => w.id);
    expect(ids).toContain(marko);
    expect(ids).toHaveLength(1);
  });

  it("verificationTier=ID_VERIFIED filters correctly", async () => {
    const idVerified = await createWaiter({ verificationTier: "ID_VERIFIED" });
    await createWaiter({ verificationTier: "UNVERIFIED" });

    const { waiters } = await (await GET(makeReq("verificationTier=ID_VERIFIED"), CTX)).json();
    const ids = waiters.map((w: { id: string }) => w.id);
    expect(ids).toContain(idVerified);
    expect(ids).toHaveLength(1);
  });

  // ── Soft-delete exclusion ───────────────────────────────────────────────────

  it("deleted waiters excluded from results", async () => {
    const live    = await createWaiter({ name: "Live" });
    const deleted = await createWaiter({ name: "Deleted", deletedAt: new Date() });

    const { waiters } = await (await GET(makeReq(), CTX)).json();
    const ids = waiters.map((w: { id: string }) => w.id);
    expect(ids).toContain(live);
    expect(ids).not.toContain(deleted);
  });

  // ── Pagination ──────────────────────────────────────────────────────────────

  it("pagination: limit and total correct", async () => {
    for (let i = 0; i < 5; i++) await createWaiter({ name: `W${i}` });

    const res = await GET(makeReq("limit=2&page=1"), CTX);
    const body = await res.json();
    expect(body.waiters).toHaveLength(2);
    expect(body.total).toBe(5);
    expect(body.pages).toBe(3);
    expect(body.page).toBe(1);
  });

  it("page 2 returns next set", async () => {
    for (let i = 0; i < 5; i++) await createWaiter({ name: `W${i}`, score: 100 - i * 10 });

    const p1 = await (await GET(makeReq("limit=3&page=1"), CTX)).json();
    const p2 = await (await GET(makeReq("limit=3&page=2"), CTX)).json();

    const p1ids = p1.waiters.map((w: { id: string }) => w.id);
    const p2ids = p2.waiters.map((w: { id: string }) => w.id);
    expect(p2ids).toHaveLength(2); // 5 total, page 2 has remainder
    expect(p1ids.some((id: string) => p2ids.includes(id))).toBe(false); // no overlap
  });
});
