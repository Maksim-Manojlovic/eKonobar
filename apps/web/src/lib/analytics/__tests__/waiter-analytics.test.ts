import { describe, it, expect } from "vitest";
import {
  computeWaiterAnalytics,
  MIN_SAMPLE,
  ON_TIME_GRACE_MIN,
  SPARK_BUCKETS,
  SWAP_CHURN_THRESHOLD,
  type RawAssignment,
  type RawPassport,
  type RawGuestReview,
  type RawSwap,
} from "../waiter-analytics";

const NOW = new Date("2026-07-09T12:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// A shift that already happened (starts 3h before NOW, window closed).
function pastStart(hoursAgo = 3): Date {
  return new Date(NOW.getTime() - hoursAgo * HOUR);
}

function assignment(over: Partial<RawAssignment>): RawAssignment {
  const start = over.shiftScheduledStart ?? pastStart();
  return {
    waiterId: "w1",
    waiterName: "Marko",
    clockInAt: start,
    clockOutAt: new Date(start.getTime() + 8 * HOUR),
    lateMinutes: 0,
    earlyExitAt: null,
    cancelledLate: false,
    shiftScheduledStart: start,
    shiftDate: start,
    ...over,
  };
}

function passport(over: Partial<RawPassport> = {}): RawPassport {
  return {
    userId: "w1",
    sanitaryBookValid: true,
    sanitaryExpiry: new Date(NOW.getTime() + 200 * DAY),
    ...over,
  };
}

describe("computeWaiterAnalytics", () => {
  it("perfect attendance scores 100", () => {
    const rows = Array.from({ length: 5 }, () => assignment({}));
    const { waiters } = computeWaiterAnalytics(rows, [passport()], 30, NOW);
    expect(waiters).toHaveLength(1);
    const w = waiters[0];
    expect(w.reliabilityScore).toBe(100);
    expect(w.completedShifts).toBe(5);
    expect(w.noShows).toBe(0);
    expect(w.onTimePct).toBe(100);
    expect(w.hoursWorked).toBe(40);
  });

  it("no-shows drop the score and raise a NO_SHOWS flag at 2+", () => {
    const rows = [
      assignment({}),
      assignment({}),
      assignment({ clockInAt: null, clockOutAt: null, lateMinutes: null }),
      assignment({ clockInAt: null, clockOutAt: null, lateMinutes: null }),
    ];
    const { waiters, flags } = computeWaiterAnalytics(rows, [passport()], 30, NOW);
    const w = waiters[0];
    expect(w.expectedShifts).toBe(4);
    expect(w.noShows).toBe(2);
    // 100 - 40 * (2/4) = 80
    expect(w.reliabilityScore).toBe(80);
    expect(flags.some((f) => f.kind === "NO_SHOWS" && f.waiterId === "w1")).toBe(true);
  });

  it("grace window keeps small lateness on-time, penalises beyond it", () => {
    const rows = [
      assignment({ lateMinutes: ON_TIME_GRACE_MIN }),   // on-time (grace)
      assignment({ lateMinutes: 30 }),                  // late
      assignment({ lateMinutes: 0 }),
    ];
    const { waiters } = computeWaiterAnalytics(rows, [passport()], 30, NOW);
    const w = waiters[0];
    expect(w.onTimeShifts).toBe(2);
    expect(w.lateShifts).toBe(1);
    expect(w.onTimePct).toBe(67);
    expect(w.avgLateMinutes).toBe(10); // 30 / 3 measurable
  });

  it("returns null score under MIN_SAMPLE", () => {
    const rows = Array.from({ length: MIN_SAMPLE - 1 }, () => assignment({}));
    const { waiters } = computeWaiterAnalytics(rows, [passport()], 30, NOW);
    expect(waiters[0].reliabilityScore).toBeNull();
  });

  it("ignores future shifts entirely", () => {
    const future = new Date(NOW.getTime() + 2 * DAY);
    const rows = [assignment({ shiftScheduledStart: future, shiftDate: future, clockInAt: null, clockOutAt: null })];
    const { waiters } = computeWaiterAnalytics(rows, [passport()], 30, NOW);
    expect(waiters).toHaveLength(0);
  });

  it("late-cancel counts as expected but not completed and flags at 2+", () => {
    const rows = [
      assignment({ cancelledLate: true, clockInAt: null, clockOutAt: null, lateMinutes: null }),
      assignment({ cancelledLate: true, clockInAt: null, clockOutAt: null, lateMinutes: null }),
      assignment({}),
    ];
    const { waiters, flags } = computeWaiterAnalytics(rows, [passport()], 30, NOW);
    const w = waiters[0];
    expect(w.lateCancels).toBe(2);
    expect(w.completedShifts).toBe(1);
    expect(w.expectedShifts).toBe(3);
    expect(flags.some((f) => f.kind === "LATE_CANCELS")).toBe(true);
  });

  it("counts missing clock-outs without inflating hours", () => {
    const start = pastStart();
    const rows = [
      assignment({ shiftScheduledStart: start, shiftDate: start, clockOutAt: null }),
    ];
    const { waiters } = computeWaiterAnalytics(rows, [passport()], 30, NOW);
    expect(waiters[0].missingClockOuts).toBe(1);
    expect(waiters[0].hoursWorked).toBe(0);
  });

  it("legacy rows without scheduledStart are unmeasurable for punctuality", () => {
    const start = pastStart();
    const rows = Array.from({ length: 3 }, () =>
      assignment({ shiftScheduledStart: null, shiftDate: start, lateMinutes: null }),
    );
    const { waiters } = computeWaiterAnalytics(rows, [passport()], 30, NOW);
    const w = waiters[0];
    expect(w.measurableShifts).toBe(0);
    expect(w.onTimePct).toBeNull();
    expect(w.avgLateMinutes).toBeNull();
    // still completed → score computed off attendance only
    expect(w.reliabilityScore).toBe(100);
  });

  it("flags expiring and invalid sanitary books", () => {
    const rows = Array.from({ length: 3 }, () => assignment({}));
    const soon = computeWaiterAnalytics(
      rows,
      [passport({ sanitaryExpiry: new Date(NOW.getTime() + 10 * DAY) })],
      30,
      NOW,
    );
    expect(soon.flags.some((f) => f.kind === "SANITARY_EXPIRING")).toBe(true);

    const invalid = computeWaiterAnalytics(
      rows,
      [passport({ sanitaryBookValid: false })],
      30,
      NOW,
    );
    expect(invalid.flags.some((f) => f.kind === "SANITARY_INVALID")).toBe(true);
  });

  it("aggregates team summary and ranks scored waiters first", () => {
    const good = Array.from({ length: 3 }, () => assignment({ waiterId: "good", waiterName: "Ana" }));
    const bad = [
      assignment({ waiterId: "bad", waiterName: "Ivan", clockInAt: null, clockOutAt: null, lateMinutes: null }),
      assignment({ waiterId: "bad", waiterName: "Ivan", clockInAt: null, clockOutAt: null, lateMinutes: null }),
      assignment({ waiterId: "bad", waiterName: "Ivan" }),
    ];
    const { team, waiters } = computeWaiterAnalytics(
      [...good, ...bad],
      [passport({ userId: "good" }), passport({ userId: "bad" })],
      30,
      NOW,
    );
    expect(team.rosterSize).toBe(2);
    expect(team.totalNoShows).toBe(2);
    expect(team.totalCompleted).toBe(4);
    expect(waiters[0].waiterId).toBe("good"); // higher reliability ranked first
  });

  it("defaults sanitary to invalid when no passport row", () => {
    const rows = Array.from({ length: 3 }, () => assignment({}));
    const { waiters } = computeWaiterAnalytics(rows, [], 30, NOW);
    expect(waiters[0].sanitaryBookValid).toBe(false);
  });

  it("guest rating is null without reviews", () => {
    const rows = Array.from({ length: 3 }, () => assignment({}));
    const { waiters } = computeWaiterAnalytics(rows, [passport()], 30, NOW);
    expect(waiters[0].guestRating).toBeNull();
    expect(waiters[0].reliabilityDelta).toBeNull();
  });
});

function guestReview(over: Partial<RawGuestReview> = {}): RawGuestReview {
  return {
    waiterId: "w1",
    overallRating: 80,
    ratingFriendliness: 80,
    ratingGuestSpeed: 80,
    ratingAttentiveness: 80,
    ...over,
  };
}

describe("computeWaiterAnalytics — guest ratings & trend", () => {
  it("aggregates guest reviews per waiter and at team level", () => {
    const rows = Array.from({ length: 3 }, () => assignment({}));
    const reviews = [
      guestReview({ overallRating: 100, ratingFriendliness: 100, ratingGuestSpeed: 100, ratingAttentiveness: null }),
      guestReview({ overallRating: 60, ratingFriendliness: 60, ratingGuestSpeed: 80, ratingAttentiveness: 40 }),
    ];
    const { waiters, team } = computeWaiterAnalytics(rows, [passport()], 30, NOW, { guestReviews: reviews });
    const g = waiters[0].guestRating!;
    expect(g.count).toBe(2);
    expect(g.overall).toBe(80);              // (100+60)/2
    expect(g.friendliness).toBe(80);         // (100+60)/2
    expect(g.attentiveness).toBe(40);        // only the 40 (null ignored)
    expect(team.teamGuestRating).toBe(80);
    expect(team.teamGuestReviewCount).toBe(2);
  });

  it("computes reliability delta vs previous window", () => {
    // Current: perfect (100). Previous: 2 no-shows of 4 → 80.
    const current = Array.from({ length: 4 }, () => assignment({}));
    const previous = [
      assignment({}),
      assignment({}),
      assignment({ clockInAt: null, clockOutAt: null, lateMinutes: null }),
      assignment({ clockInAt: null, clockOutAt: null, lateMinutes: null }),
    ];
    const { waiters } = computeWaiterAnalytics(current, [passport()], 30, NOW, { previousAssignments: previous });
    expect(waiters[0].reliabilityScore).toBe(100);
    expect(waiters[0].reliabilityDelta).toBe(20); // 100 - 80
  });

  it("delta is null when previous window is unscored", () => {
    const current = Array.from({ length: 4 }, () => assignment({}));
    const previous = [assignment({})]; // 1 shift < MIN_SAMPLE → null
    const { waiters } = computeWaiterAnalytics(current, [passport()], 30, NOW, { previousAssignments: previous });
    expect(waiters[0].reliabilityDelta).toBeNull();
  });
});

describe("computeWaiterAnalytics — swap churn & activity", () => {
  it("counts swap requests and flags churn at threshold", () => {
    const rows = Array.from({ length: 3 }, () => assignment({}));
    const swaps: RawSwap[] = Array.from({ length: SWAP_CHURN_THRESHOLD }, () => ({
      waiterId: "w1",
      requestedAt: NOW,
    }));
    const { waiters, flags } = computeWaiterAnalytics(rows, [passport()], 30, NOW, { swaps });
    expect(waiters[0].swapRequests).toBe(SWAP_CHURN_THRESHOLD);
    expect(flags.some((f) => f.kind === "SWAP_CHURN")).toBe(true);
  });

  it("does not flag churn below threshold", () => {
    const rows = Array.from({ length: 3 }, () => assignment({}));
    const swaps: RawSwap[] = [{ waiterId: "w1", requestedAt: NOW }];
    const { waiters, flags } = computeWaiterAnalytics(rows, [passport()], 30, NOW, { swaps });
    expect(waiters[0].swapRequests).toBe(1);
    expect(flags.some((f) => f.kind === "SWAP_CHURN")).toBe(false);
  });

  it("emits a fixed-length activity series counting worked shifts", () => {
    // Two worked shifts near the end of a 30-day window.
    const rows = [
      assignment({ shiftScheduledStart: pastStart(2), shiftDate: pastStart(2) }),
      assignment({ shiftScheduledStart: pastStart(3), shiftDate: pastStart(3) }),
    ];
    const { waiters } = computeWaiterAnalytics(rows, [passport()], 30, NOW, {});
    const a = waiters[0].activity;
    expect(a).toHaveLength(SPARK_BUCKETS);
    expect(a.reduce((s, n) => s + n, 0)).toBe(2);
    // Both fall in the last bucket (most recent).
    expect(a[SPARK_BUCKETS - 1]).toBe(2);
  });
});
