import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
// Pin the no-Redis path so the DB tally runs deterministically under a set REDIS_URL.
vi.mock("@/lib/core/redis", () => ({ redis: null }));
vi.mock("@/lib/core/db", () => ({ db: { user: { findMany: vi.fn() } } }));
vi.mock("@/lib/core/logger", () => ({ default: { warn: vi.fn(), error: vi.fn() } }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { GET } from "../route";
import { BELGRADE_MUNICIPALITIES } from "@/lib/geo/municipalities";

const CTX = { params: Promise.resolve({}) };
const makeReq = () => new NextRequest("http://localhost/api/waiters/coverage");
const session = (role: string) => vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u", role } } as never);

function reach(...arrs: string[][]) {
  return arrs.map((workMunicipalities) => ({ waiterPassport: { workMunicipalities } }));
}

describe("GET /api/waiters/coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findMany).mockResolvedValue([] as never);
  });

  it("WAITER → 403", async () => {
    session("WAITER");
    expect((await GET(makeReq(), CTX)).status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    expect((await GET(makeReq(), CTX)).status).toBe(401);
  });

  it.each(["VENUE_OWNER", "HEADHUNTER"])("%s → 200", async (role) => {
    session(role);
    expect((await GET(makeReq(), CTX)).status).toBe(200);
  });

  it("only counts available waiters (query filters currentlyAvailable)", async () => {
    session("VENUE_OWNER");
    await GET(makeReq(), CTX);
    const where = vi.mocked(db.user.findMany).mock.calls[0][0]!.where as {
      role: string; deletedAt: null; waiterPassport: Record<string, unknown>;
    };
    expect(where.role).toBe("WAITER");
    expect(where.deletedAt).toBeNull();
    expect(where.waiterPassport).toMatchObject({ currentlyAvailable: true });
  });

  it("returns a cell for every municipality, in canonical order", async () => {
    session("VENUE_OWNER");
    const json = await (await GET(makeReq(), CTX)).json();
    expect(json.map((c: { municipality: string }) => c.municipality)).toEqual([...BELGRADE_MUNICIPALITIES]);
  });

  it("tallies reach — a waiter with two municipalities counts for both", async () => {
    session("VENUE_OWNER");
    vi.mocked(db.user.findMany).mockResolvedValue(
      reach(["Vračar", "Zemun"], ["Vračar"], ["Zemun"]) as never,
    );
    const json = await (await GET(makeReq(), CTX)).json();
    const by = Object.fromEntries(json.map((c: { municipality: string; availableCount: number }) => [c.municipality, c.availableCount]));
    expect(by["Vračar"]).toBe(2);
    expect(by["Zemun"]).toBe(2);
    expect(by["Surčin"]).toBe(0);
  });

  it("ignores a legacy non-canonical reach value", async () => {
    session("VENUE_OWNER");
    vi.mocked(db.user.findMany).mockResolvedValue(reach(["Atlantis", "Vračar"]) as never);
    const json = await (await GET(makeReq(), CTX)).json();
    const total = json.reduce((s: number, c: { availableCount: number }) => s + c.availableCount, 0);
    expect(total).toBe(1); // only Vračar counted, Atlantis dropped
  });

  it("no available waiters → all zero", async () => {
    session("VENUE_OWNER");
    const json = await (await GET(makeReq(), CTX)).json();
    expect(json.every((c: { availableCount: number }) => c.availableCount === 0)).toBe(true);
    expect(json).toHaveLength(BELGRADE_MUNICIPALITIES.length);
  });
});
