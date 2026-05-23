import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  dbRaw: {
    user:             { findMany: vi.fn() },
    passportPayment:  { findMany: vi.fn() },
    review:           { findMany: vi.fn() },
    jobApplication:   { findMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { dbRaw } from "@/lib/db";
import { GET } from "../route";

const NOW = new Date("2025-01-10T12:00:00Z");
const EARLIER = new Date("2025-01-10T11:00:00Z");
const EARLIEST = new Date("2025-01-10T10:00:00Z");

function mockSession(role = "ADMIN") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

function makeReq() {
  return new NextRequest("http://localhost/api/admin/activity");
}

function setupDefaultMocks() {
  vi.mocked(dbRaw.user.findMany).mockResolvedValue([
    { id: "u-1", name: "Marko", email: "m@test.com", role: "WAITER", createdAt: NOW },
  ] as never);
  vi.mocked(dbRaw.passportPayment.findMany).mockResolvedValue([
    { id: "p-1", userId: "u-1", tier: "PRO", amountRsd: 29000, createdAt: EARLIER,
      user: { name: "Marko", email: "m@test.com" } },
  ] as never);
  vi.mocked(dbRaw.review.findMany).mockResolvedValue([
    { id: "r-1", direction: "WAITER_TO_VENUE", status: "PUBLISHED", createdAt: EARLIEST,
      author: { name: "Marko" }, venue: { name: "Kafana Test" } },
  ] as never);
  vi.mocked(dbRaw.jobApplication.findMany).mockResolvedValue([
    { id: "a-1", appliedAt: EARLIEST,
      waiter: { name: "Marko" },
      jobPost: { title: "Konobar", venue: { name: "Kafana Test" } } },
  ] as never);
}

describe("GET /api/admin/activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    setupDefaultMocks();
  });

  it("ADMIN gets activity → 200", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
  });

  it("non-ADMIN → 403", async () => {
    mockSession("VENUE_OWNER");
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns array of events", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  });

  it("events sorted newest first", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    // NOW > EARLIER > EARLIEST
    expect(json[0].ts).toBe(NOW.toISOString());
    expect(json[1].ts).toBe(EARLIER.toISOString());
  });

  it("registration event has correct shape", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    const reg = json.find((e: { type: string }) => e.type === "registration");
    expect(reg).toBeDefined();
    expect(reg.id).toBe("reg-u-1");
    expect(reg.title).toContain("Marko");
    expect(reg.sub).toBe("Konobar");
    expect(reg.link).toBe("/admin/users");
  });

  it("payment event has correct shape", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    const pay = json.find((e: { type: string }) => e.type === "payment");
    expect(pay).toBeDefined();
    expect(pay.id).toBe("pay-p-1");
    expect(pay.title).toContain("PRO");
    expect(pay.title).toContain("290"); // 29000 / 100 = 290
    expect(pay.sub).toBe("Marko");
  });

  it("review event has correct shape", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    const rev = json.find((e: { type: string }) => e.type === "review");
    expect(rev).toBeDefined();
    expect(rev.id).toBe("rev-r-1");
    expect(rev.sub).toBe("Kafana Test"); // venue.name takes priority
  });

  it("DISPUTED review has moderation link", async () => {
    vi.mocked(dbRaw.review.findMany).mockResolvedValue([
      { id: "r-2", direction: "GUEST_TO_VENUE", status: "DISPUTED", createdAt: NOW,
        author: null, venue: { name: "Kafana" } },
    ] as never);

    const res = await GET(makeReq());
    const json = await res.json();
    const rev = json.find((e: { type: string }) => e.type === "review");
    expect(rev.link).toBe("/admin/moderation");
  });

  it("non-DISPUTED review has no link", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    const rev = json.find((e: { type: string }) => e.type === "review");
    expect(rev.link).toBeUndefined();
  });

  it("application event has correct shape", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    const app = json.find((e: { type: string }) => e.type === "application");
    expect(app).toBeDefined();
    expect(app.id).toBe("app-a-1");
    expect(app.title).toContain("Konobar");
    expect(app.sub).toContain("Marko");
    expect(app.sub).toContain("Kafana Test");
  });

  it("caps at 25 events", async () => {
    const manyUsers = Array.from({ length: 30 }, (_, i) => ({
      id: `u-${i}`, name: `User ${i}`, email: `u${i}@test.com`,
      role: "WAITER", createdAt: new Date(Date.now() - i * 1000),
    }));
    vi.mocked(dbRaw.user.findMany).mockResolvedValue(manyUsers as never);
    vi.mocked(dbRaw.passportPayment.findMany).mockResolvedValue([]);
    vi.mocked(dbRaw.review.findMany).mockResolvedValue([]);
    vi.mocked(dbRaw.jobApplication.findMany).mockResolvedValue([]);

    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.length).toBe(25);
  });

  it("null author review uses venue name", async () => {
    vi.mocked(dbRaw.review.findMany).mockResolvedValue([
      { id: "r-3", direction: "GUEST_TO_VENUE", status: "PUBLISHED", createdAt: NOW,
        author: null, venue: { name: "Kafana XYZ" } },
    ] as never);

    const res = await GET(makeReq());
    const json = await res.json();
    const rev = json.find((e: { type: string }) => e.type === "review");
    expect(rev.sub).toBe("Kafana XYZ");
  });

  it("null venue + null author review → 'Gost'", async () => {
    vi.mocked(dbRaw.review.findMany).mockResolvedValue([
      { id: "r-4", direction: "GUEST_TO_VENUE", status: "PUBLISHED", createdAt: NOW,
        author: null, venue: null },
    ] as never);

    const res = await GET(makeReq());
    const json = await res.json();
    const rev = json.find((e: { type: string }) => e.type === "review");
    expect(rev.sub).toBe("Gost");
  });

  it("VENUE_OWNER role maps to correct sub label", async () => {
    vi.mocked(dbRaw.user.findMany).mockResolvedValue([
      { id: "o-1", name: "Petar", email: "p@test.com", role: "VENUE_OWNER", createdAt: NOW },
    ] as never);

    const res = await GET(makeReq());
    const json = await res.json();
    const reg = json.find((e: { type: string }) => e.type === "registration");
    expect(reg.sub).toBe("Vlasnik lokala");
  });

  it("HEADHUNTER role maps to correct sub label", async () => {
    vi.mocked(dbRaw.user.findMany).mockResolvedValue([
      { id: "h-1", name: "Ana", email: "a@test.com", role: "HEADHUNTER", createdAt: NOW },
    ] as never);

    const res = await GET(makeReq());
    const json = await res.json();
    const reg = json.find((e: { type: string }) => e.type === "registration");
    expect(reg.sub).toBe("Headhunter");
  });
});
