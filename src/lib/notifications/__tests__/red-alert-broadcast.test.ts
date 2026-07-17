import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/core/db", () => ({ db: { user: { findMany: vi.fn() } } }));
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/core/logger", () => ({ default: { warn: vi.fn(), error: vi.fn() } }));

import { db } from "@/lib/core/db";
import { notify } from "@/lib/notifications/notify";
import { broadcastRedAlert } from "../red-alert-broadcast";

const ACTIVE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const EXPIRED = new Date(Date.now() - 1000);

const BROADCAST = {
  jobPostId:    "job-1",
  jobTitle:     "Konobar hitno",
  venueName:    "Kafana Test",
  municipality: "Vračar",
};

function rows(...tiers: Array<{ id: string; tier: string; exp: Date | null }>) {
  return tiers.map((t) => ({
    id: t.id,
    waiterPassport: { passportTier: t.tier, subscriptionExpiresAt: t.exp },
  }));
}

describe("broadcastRedAlert", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filters the query to available PRO/PRO_PLUS waiters in the reach municipality", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([] as never);
    await broadcastRedAlert(BROADCAST);

    const where = vi.mocked(db.user.findMany).mock.calls[0][0]!.where as {
      role: string;
      deletedAt: null;
      waiterPassport: Record<string, unknown>;
    };
    expect(where.role).toBe("WAITER");
    expect(where.deletedAt).toBeNull();
    expect(where.waiterPassport).toMatchObject({
      currentlyAvailable: true,
      workMunicipalities: { has: "Vračar" },
      passportTier: { in: ["PRO", "PRO_PLUS"] },
    });
  });

  it("notifies each active PRO/PRO_PLUS recipient with RED_ALERT_POSTED", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue(
      rows(
        { id: "w-pro", tier: "PRO", exp: ACTIVE },
        { id: "w-proplus", tier: "PRO_PLUS", exp: ACTIVE },
      ) as never,
    );

    const count = await broadcastRedAlert(BROADCAST);

    expect(count).toBe(2);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith(
      "w-pro",
      "RED_ALERT_POSTED",
      "Red Alert u Vračar",
      expect.stringContaining("Kafana Test"),
      "/jobs/job-1",
    );
  });

  it("drops an expired subscription that the DB tier filter still returned", async () => {
    // passportTier=PRO but subscription lapsed → effectively FREE, must not be pinged.
    vi.mocked(db.user.findMany).mockResolvedValue(
      rows(
        { id: "w-active", tier: "PRO", exp: ACTIVE },
        { id: "w-expired", tier: "PRO", exp: EXPIRED },
      ) as never,
    );

    const count = await broadcastRedAlert(BROADCAST);

    expect(count).toBe(1);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("w-active", expect.anything(), expect.anything(), expect.anything(), expect.anything());
    expect(notify).not.toHaveBeenCalledWith("w-expired", expect.anything(), expect.anything(), expect.anything(), expect.anything());
  });

  it("caps recipients at 50 even when more match", async () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ id: `w-${i}`, tier: "PRO", exp: ACTIVE }));
    vi.mocked(db.user.findMany).mockResolvedValue(rows(...many) as never);

    const count = await broadcastRedAlert(BROADCAST);

    expect(count).toBe(50);
    expect(notify).toHaveBeenCalledTimes(50);
  });

  it("no matching waiters → notifies nobody, returns 0", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([] as never);
    expect(await broadcastRedAlert(BROADCAST)).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it("one failed notify does not abort the rest (allSettled)", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue(
      rows(
        { id: "w-1", tier: "PRO", exp: ACTIVE },
        { id: "w-2", tier: "PRO", exp: ACTIVE },
      ) as never,
    );
    vi.mocked(notify).mockRejectedValueOnce(new Error("push gateway down"));

    const count = await broadcastRedAlert(BROADCAST);

    expect(count).toBe(2); // both attempted
    expect(notify).toHaveBeenCalledTimes(2);
  });
});
