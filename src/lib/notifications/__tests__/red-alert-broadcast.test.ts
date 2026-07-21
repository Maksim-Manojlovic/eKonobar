import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/core/db", () => ({ db: { user: { findMany: vi.fn() } } }));
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/core/logger", () => ({ default: { warn: vi.fn(), error: vi.fn() } }));

import { db } from "@/lib/core/db";
import { notify } from "@/lib/notifications/notify";
import { broadcastRedAlert } from "../red-alert-broadcast";

const BROADCAST = {
  jobPostId:    "job-1",
  jobTitle:     "Konobar hitno",
  venueName:    "Kafana Test",
  municipality: "Vračar",
};

const rows = (...ids: string[]) => ids.map((id) => ({ id }));

describe("broadcastRedAlert", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filters the query to available waiters in the reach municipality", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([] as never);
    await broadcastRedAlert(BROADCAST);

    const call = vi.mocked(db.user.findMany).mock.calls[0][0]!;
    const where = call.where as {
      role: string;
      deletedAt: null;
      waiterPassport: Record<string, unknown>;
    };
    expect(where.role).toBe("WAITER");
    expect(where.deletedAt).toBeNull();
    expect(where.waiterPassport).toMatchObject({
      currentlyAvailable: true,
      workMunicipalities: { has: "Vračar" },
    });
    // No tier filter — the paid subscription product was removed.
    expect(where.waiterPassport).not.toHaveProperty("passportTier");
    expect(call.take).toBe(50);
  });

  it("notifies each recipient with RED_ALERT_POSTED", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue(rows("w-1", "w-2") as never);

    const count = await broadcastRedAlert(BROADCAST);

    expect(count).toBe(2);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith(
      "w-1",
      "RED_ALERT_POSTED",
      "Red Alert u Vračar",
      expect.stringContaining("Kafana Test"),
      "/jobs/job-1",
    );
  });

  it("no matching waiters → notifies nobody, returns 0", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([] as never);
    expect(await broadcastRedAlert(BROADCAST)).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it("one failed notify does not abort the rest (allSettled)", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue(rows("w-1", "w-2") as never);
    vi.mocked(notify).mockRejectedValueOnce(new Error("push gateway down"));

    const count = await broadcastRedAlert(BROADCAST);

    expect(count).toBe(2); // both attempted
    expect(notify).toHaveBeenCalledTimes(2);
  });
});
