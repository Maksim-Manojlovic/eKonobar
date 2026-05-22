import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    jobApplication: { findUnique: vi.fn(), update: vi.fn() },
  },
  dbRaw: {
    $transaction: vi.fn(),
    engagementRecord: { create: vi.fn() },
    waiterPassport:   { updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/sync-scores", () => ({ syncPassportScore: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notify",      () => ({ notify:            vi.fn().mockResolvedValue(undefined) }));

import { getServerSession } from "next-auth";
import { db, dbRaw } from "@/lib/db";
import { syncPassportScore } from "@/lib/sync-scores";
import { notify } from "@/lib/notify";
import { PATCH } from "../route";

const OWNER_ID    = "owner-1";
const WAITER_ID   = "waiter-1";
const APP_ID      = "app-1";
const VENUE_ID    = "venue-1";
const JOB_POST_ID = "job-1";

const BASE_APPLICATION = {
  id: APP_ID,
  waiterId: WAITER_ID,
  jobPostId: JOB_POST_ID,
  status: "PENDING",
  jobPost: {
    title: "Konobar",
    ownerId: OWNER_ID,
    venueId: VENUE_ID,
    engagementType: "FULL_TIME",
    startDate: new Date("2025-01-01"),
    endDate:   new Date("2025-06-01"),
    venue: { name: "Kafana Test" },
  },
};

function makeReq(body: object) {
  return new NextRequest(`http://localhost/api/jobs/applications/${APP_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeCtx() {
  return { params: Promise.resolve({ id: APP_ID }) };
}

function mockSession(role: string, id: string) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

describe("PATCH /api/jobs/applications/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession("VENUE_OWNER", OWNER_ID);
    vi.mocked(db.jobApplication.findUnique).mockResolvedValue(BASE_APPLICATION as never);
    vi.mocked(db.jobApplication.update).mockImplementation((args: { data: { status: string } }) =>
      Promise.resolve({ ...BASE_APPLICATION, status: args.data.status }) as never,
    );
    vi.mocked(dbRaw.$transaction).mockResolvedValue([{}, {}]);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await PATCH(makeReq({ status: "SHORTLISTED" }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid status value", async () => {
    const res = await PATCH(makeReq({ status: "INVALID_STATUS" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("returns 404 when application not found", async () => {
    vi.mocked(db.jobApplication.findUnique).mockResolvedValue(null);
    const res = await PATCH(makeReq({ status: "SHORTLISTED" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns 403 when session user is neither owner nor waiter", async () => {
    mockSession("HEADHUNTER", "hh-1");
    const res = await PATCH(makeReq({ status: "SHORTLISTED" }), makeCtx());
    expect(res.status).toBe(403);
  });

  describe("VENUE_OWNER transitions", () => {
    it("PENDING → SHORTLISTED succeeds", async () => {
      const res = await PATCH(makeReq({ status: "SHORTLISTED" }), makeCtx());
      expect(res.status).toBe(200);
    });

    it("PENDING → ACCEPTED succeeds", async () => {
      const res = await PATCH(makeReq({ status: "ACCEPTED" }), makeCtx());
      expect(res.status).toBe(200);
    });

    it("PENDING → REJECTED succeeds", async () => {
      const res = await PATCH(makeReq({ status: "REJECTED" }), makeCtx());
      expect(res.status).toBe(200);
    });

    it("PENDING → WITHDRAWN blocked for owner", async () => {
      const res = await PATCH(makeReq({ status: "WITHDRAWN" }), makeCtx());
      expect(res.status).toBe(400);
      const d = await res.json();
      expect(d.error).toMatch(/cannot transition/i);
    });

    it("SHORTLISTED → ACCEPTED succeeds", async () => {
      vi.mocked(db.jobApplication.findUnique).mockResolvedValue({
        ...BASE_APPLICATION, status: "SHORTLISTED",
      } as never);
      const res = await PATCH(makeReq({ status: "ACCEPTED" }), makeCtx());
      expect(res.status).toBe(200);
    });

    it("SHORTLISTED → REJECTED succeeds", async () => {
      vi.mocked(db.jobApplication.findUnique).mockResolvedValue({
        ...BASE_APPLICATION, status: "SHORTLISTED",
      } as never);
      const res = await PATCH(makeReq({ status: "REJECTED" }), makeCtx());
      expect(res.status).toBe(200);
    });

    it("ACCEPTED → COMPLETED triggers engagement record and passport update", async () => {
      vi.mocked(db.jobApplication.findUnique).mockResolvedValue({
        ...BASE_APPLICATION, status: "ACCEPTED",
      } as never);
      await PATCH(makeReq({ status: "COMPLETED" }), makeCtx());
      expect(vi.mocked(dbRaw.$transaction)).toHaveBeenCalled();
    });

    it("COMPLETED fires syncPassportScore fire-and-forget", async () => {
      vi.mocked(db.jobApplication.findUnique).mockResolvedValue({
        ...BASE_APPLICATION, status: "ACCEPTED",
      } as never);
      await PATCH(makeReq({ status: "COMPLETED" }), makeCtx());
      await new Promise((r) => setTimeout(r, 0));
      expect(syncPassportScore).toHaveBeenCalledWith(WAITER_ID);
    });

    it("notifies waiter on ACCEPTED", async () => {
      await PATCH(makeReq({ status: "ACCEPTED" }), makeCtx());
      await new Promise((r) => setTimeout(r, 0));
      expect(notify).toHaveBeenCalledWith(
        WAITER_ID,
        "APPLICATION_STATUS_CHANGED",
        expect.any(String),
        expect.any(String),
        expect.any(String),
      );
    });

    it("notifies waiter on REJECTED", async () => {
      await PATCH(makeReq({ status: "REJECTED" }), makeCtx());
      await new Promise((r) => setTimeout(r, 0));
      expect(notify).toHaveBeenCalledWith(
        WAITER_ID, "APPLICATION_STATUS_CHANGED", expect.any(String), expect.any(String), expect.any(String),
      );
    });

    it("does not notify on SHORTLISTED (no message key)", async () => {
      await PATCH(makeReq({ status: "SHORTLISTED" }), makeCtx());
      await new Promise((r) => setTimeout(r, 0));
      // notify is called with SHORTLISTED message
      expect(notify).toHaveBeenCalled();
    });
  });

  describe("WAITER transitions", () => {
    beforeEach(() => {
      mockSession("WAITER", WAITER_ID);
    });

    it("PENDING → WITHDRAWN succeeds", async () => {
      const res = await PATCH(makeReq({ status: "WITHDRAWN" }), makeCtx());
      expect(res.status).toBe(200);
    });

    it("SHORTLISTED → WITHDRAWN succeeds", async () => {
      vi.mocked(db.jobApplication.findUnique).mockResolvedValue({
        ...BASE_APPLICATION, status: "SHORTLISTED",
      } as never);
      const res = await PATCH(makeReq({ status: "WITHDRAWN" }), makeCtx());
      expect(res.status).toBe(200);
    });

    it("PENDING → ACCEPTED blocked for waiter", async () => {
      const res = await PATCH(makeReq({ status: "ACCEPTED" }), makeCtx());
      expect(res.status).toBe(400);
    });

    it("PENDING → SHORTLISTED blocked for waiter", async () => {
      const res = await PATCH(makeReq({ status: "SHORTLISTED" }), makeCtx());
      expect(res.status).toBe(400);
    });

    it("ACCEPTED → WITHDRAWN blocked for waiter", async () => {
      vi.mocked(db.jobApplication.findUnique).mockResolvedValue({
        ...BASE_APPLICATION, status: "ACCEPTED",
      } as never);
      const res = await PATCH(makeReq({ status: "WITHDRAWN" }), makeCtx());
      expect(res.status).toBe(400);
    });

    it("waiter action does not notify (notify only fires for owner actions)", async () => {
      await PATCH(makeReq({ status: "WITHDRAWN" }), makeCtx());
      await new Promise((r) => setTimeout(r, 0));
      expect(notify).not.toHaveBeenCalled();
    });
  });
});
