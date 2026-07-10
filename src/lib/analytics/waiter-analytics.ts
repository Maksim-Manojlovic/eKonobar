// Pure venue → waiter reliability analytics.
//
// Zero DB imports — the API route fetches raw rows, this file computes.
// Kept pure so it unit-tests without a database and is safe to import from
// client code (venue-types.ts re-exports the response types below).

/* ── Tunables ────────────────────────────────────────────────────────────── */

/** lateMinutes ≤ this still counts as on-time (grace). */
export const ON_TIME_GRACE_MIN = 5;
/** Below this many expected shifts we don't score — one bad shift ≠ 0/100. */
export const MIN_SAMPLE = 3;
/** Sanitary book within this many days of expiry (or expired) → red flag. */
export const SANITARY_WARN_DAYS = 30;
/** Swap requests initiated in the window at/above this → churn flag. */
export const SWAP_CHURN_THRESHOLD = 3;
/** Number of buckets in the per-waiter activity sparkline. */
export const SPARK_BUCKETS = 8;
/** A no-show is only counted once the clock-in window has closed. */
const CLOCKIN_WINDOW_CLOSE_MIN = 60;

// Reliability penalty weights (applied to the respective rates, 0..1).
const PENALTY = {
  noShow:     40,
  late:       20,
  earlyExit:  15,
  lateCancel: 25,
} as const;

/* ── Raw input (what the route passes in) ────────────────────────────────── */

export type RawAssignment = {
  waiterId: string;
  waiterName: string | null;
  clockInAt: Date | null;
  clockOutAt: Date | null;
  lateMinutes: number | null;
  earlyExitAt: Date | null;
  cancelledLate: boolean;
  /** Full UTC start — null for legacy rows (then punctuality is unmeasurable). */
  shiftScheduledStart: Date | null;
  /** Shift day — always present, used as a coarse "is it in the past" fallback. */
  shiftDate: Date;
};

export type RawPassport = {
  userId: string;
  sanitaryBookValid: boolean;
  sanitaryExpiry: Date | null;
  passportTier: string;
};

/** A swap request initiated by a waiter (fromAssignment.waiterId) in the window. */
export type RawSwap = {
  waiterId: string;
  requestedAt: Date;
};

/** A published GUEST_TO_WAITER review, keyed by the waiter it rates (subjectId). */
export type RawGuestReview = {
  waiterId: string;
  overallRating: number; // 0–100
  ratingFriendliness: number | null;
  ratingGuestSpeed: number | null;
  ratingAttentiveness: number | null;
};

/* ── Output (what the API returns / the client renders) ──────────────────── */

/** Aggregated guest sentiment for one waiter (null dims = no guest rated them). */
export type GuestRating = {
  count: number;
  overall: number;
  friendliness: number | null;
  guestSpeed: number | null;
  attentiveness: number | null;
};

export type WaiterReliability = {
  waiterId: string;
  name: string | null;
  /** Shifts they were expected at (completed + no-show + late-cancel). */
  expectedShifts: number;
  completedShifts: number;
  noShows: number;
  lateCancels: number;
  /** Completed shifts with a measurable lateMinutes value (needs scheduledStart). */
  measurableShifts: number;
  onTimeShifts: number;
  lateShifts: number;
  earlyExits: number;
  /** On-time % of measurable shifts, or null when nothing measurable. */
  onTimePct: number | null;
  /** Mean late minutes across measurable shifts (0 when none late), or null. */
  avgLateMinutes: number | null;
  hoursWorked: number;
  /** Completed shifts missing a clock-out — hoursWorked understates for these. */
  missingClockOuts: number;
  /** 0–100 venue-local reliability, or null under MIN_SAMPLE. */
  reliabilityScore: number | null;
  /** reliabilityScore(current) − reliabilityScore(previous window); null if either unscored. */
  reliabilityDelta: number | null;
  /** Guest sentiment for this waiter at this venue, or null when no guest reviews. */
  guestRating: GuestRating | null;
  /** Swap requests this waiter initiated in the window (churn signal). */
  swapRequests: number;
  /** Completed-shift count per time bucket across the window (SPARK_BUCKETS long). */
  activity: number[];
  passportTier: string;
  sanitaryBookValid: boolean;
  sanitaryExpiry: string | null;
};

export type WaiterFlag = {
  waiterId: string;
  name: string | null;
  kind: "NO_SHOWS" | "LATE_CANCELS" | "LOW_RELIABILITY" | "SANITARY_EXPIRING" | "SANITARY_INVALID" | "SWAP_CHURN";
  detail: string;
};

export type AnalyticsTeamSummary = {
  rosterSize: number;
  totalExpectedShifts: number;
  totalCompleted: number;
  totalNoShows: number;
  /** Team on-time % across all measurable shifts, or null. */
  teamOnTimePct: number | null;
  totalHours: number;
  /** Venue-wide average guest overall rating (0–100), or null when none. */
  teamGuestRating: number | null;
  teamGuestReviewCount: number;
};

export type WaiterAnalytics = {
  period: number;
  team: AnalyticsTeamSummary;
  waiters: WaiterReliability[];
  flags: WaiterFlag[];
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const effectiveStart = (a: RawAssignment): Date => a.shiftScheduledStart ?? a.shiftDate;

/** Has the shift already happened (window closed) relative to `now`? */
function isPast(a: RawAssignment, now: Date): boolean {
  const start = effectiveStart(a);
  const closeMs = a.shiftScheduledStart ? CLOCKIN_WINDOW_CLOSE_MIN * 60_000 : 0;
  return start.getTime() + closeMs < now.getTime();
}

function hoursBetween(inAt: Date, outAt: Date): number {
  return Math.max(0, (outAt.getTime() - inAt.getTime()) / 3_600_000);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Group a waiter's *past* assignments by waiterId. */
function groupPast(assignments: RawAssignment[], now: Date): Map<string, RawAssignment[]> {
  const byWaiter = new Map<string, RawAssignment[]>();
  for (const a of assignments) {
    if (!isPast(a, now)) continue;
    const list = byWaiter.get(a.waiterId);
    if (list) list.push(a);
    else byWaiter.set(a.waiterId, [a]);
  }
  return byWaiter;
}

type ShiftStats = {
  expectedShifts: number;
  completedShifts: number;
  noShows: number;
  lateCancels: number;
  measurableShifts: number;
  onTimeShifts: number;
  lateShifts: number;
  earlyExits: number;
  onTimePct: number | null;
  avgLateMinutes: number | null;
  hoursWorked: number;
  missingClockOuts: number;
  reliabilityScore: number | null;
};

/** Reduce one waiter's assignment list into attendance/punctuality stats. */
function computeShiftStats(list: RawAssignment[]): ShiftStats {
  let completedShifts = 0, noShows = 0, lateCancels = 0, measurableShifts = 0;
  let onTimeShifts = 0, lateShifts = 0, earlyExits = 0;
  let lateMinutesSum = 0, hoursWorked = 0, missingClockOuts = 0;

  for (const a of list) {
    if (a.cancelledLate) { lateCancels++; continue; }
    if (a.clockInAt) {
      completedShifts++;
      if (a.earlyExitAt) earlyExits++;
      if (a.clockOutAt) hoursWorked += hoursBetween(a.clockInAt, a.clockOutAt);
      else missingClockOuts++;
      if (a.lateMinutes !== null) {
        measurableShifts++;
        if (a.lateMinutes <= ON_TIME_GRACE_MIN) onTimeShifts++;
        else { lateShifts++; lateMinutesSum += a.lateMinutes; }
      }
    } else {
      noShows++;
    }
  }

  const expectedShifts = completedShifts + noShows + lateCancels;
  const onTimePct = measurableShifts > 0 ? Math.round((onTimeShifts / measurableShifts) * 100) : null;
  const avgLateMinutes = measurableShifts > 0 ? round1(lateMinutesSum / measurableShifts) : null;

  let reliabilityScore: number | null = null;
  if (expectedShifts >= MIN_SAMPLE) {
    const noShowRate     = noShows / expectedShifts;
    const lateCancelRate = lateCancels / expectedShifts;
    const lateRate       = measurableShifts > 0 ? lateShifts / measurableShifts : 0;
    const earlyExitRate  = completedShifts > 0 ? earlyExits / completedShifts : 0;
    const raw = 100
      - PENALTY.noShow     * noShowRate
      - PENALTY.lateCancel * lateCancelRate
      - PENALTY.late       * lateRate
      - PENALTY.earlyExit  * earlyExitRate;
    reliabilityScore = Math.max(0, Math.min(100, Math.round(raw)));
  }

  return {
    expectedShifts, completedShifts, noShows, lateCancels, measurableShifts,
    onTimeShifts, lateShifts, earlyExits, onTimePct, avgLateMinutes,
    hoursWorked: round1(hoursWorked), missingClockOuts, reliabilityScore,
  };
}

/** Bucket completed shifts into SPARK_BUCKETS bins across [windowStart, now]. */
function bucketActivity(list: RawAssignment[], windowStart: Date, now: Date): number[] {
  const buckets = new Array<number>(SPARK_BUCKETS).fill(0);
  const span = now.getTime() - windowStart.getTime();
  if (span <= 0) return buckets;
  for (const a of list) {
    if (!a.clockInAt) continue; // only worked shifts show as activity
    const t = effectiveStart(a).getTime();
    const idx = Math.min(SPARK_BUCKETS - 1, Math.max(0, Math.floor(((t - windowStart.getTime()) / span) * SPARK_BUCKETS)));
    buckets[idx]++;
  }
  return buckets;
}

/** Average a list of numbers ignoring null/undefined; null when all missing. */
function avgOrNull(values: Array<number | null>): number | null {
  let sum = 0, n = 0;
  for (const v of values) if (v !== null) { sum += v; n++; }
  return n > 0 ? Math.round(sum / n) : null;
}

/** Aggregate guest reviews per waiter. */
function aggregateGuest(reviews: RawGuestReview[]): Map<string, GuestRating> {
  const byWaiter = new Map<string, RawGuestReview[]>();
  for (const r of reviews) {
    const list = byWaiter.get(r.waiterId);
    if (list) list.push(r);
    else byWaiter.set(r.waiterId, [r]);
  }
  const out = new Map<string, GuestRating>();
  for (const [waiterId, list] of byWaiter) {
    out.set(waiterId, {
      count: list.length,
      overall: Math.round(list.reduce((s, r) => s + r.overallRating, 0) / list.length),
      friendliness:  avgOrNull(list.map((r) => r.ratingFriendliness)),
      guestSpeed:    avgOrNull(list.map((r) => r.ratingGuestSpeed)),
      attentiveness: avgOrNull(list.map((r) => r.ratingAttentiveness)),
    });
  }
  return out;
}

/* ── Core ────────────────────────────────────────────────────────────────── */

export type ComputeExtras = {
  /** Assignments from the prior window (period ago → 2× ago) — powers trend. */
  previousAssignments?: RawAssignment[];
  /** Published GUEST_TO_WAITER reviews in the current window. */
  guestReviews?: RawGuestReview[];
  /** Swap requests initiated in the current window (churn signal). */
  swaps?: RawSwap[];
};

/**
 * Compute per-waiter reliability + guest sentiment + trend + team summary + red flags.
 * `now` is injectable for deterministic tests.
 */
export function computeWaiterAnalytics(
  assignments: RawAssignment[],
  passports: RawPassport[],
  period: number,
  now: Date = new Date(),
  extras: ComputeExtras = {},
): WaiterAnalytics {
  const passportByUser = new Map(passports.map((p) => [p.userId, p]));
  const guestByWaiter = aggregateGuest(extras.guestReviews ?? []);
  const windowStart = new Date(now.getTime() - period * 24 * 3_600_000);

  // Swap requests initiated per waiter in the window.
  const swapCountByWaiter = new Map<string, number>();
  for (const s of extras.swaps ?? []) {
    swapCountByWaiter.set(s.waiterId, (swapCountByWaiter.get(s.waiterId) ?? 0) + 1);
  }

  // Previous-window reliability score per waiter (for the trend delta).
  const prevScoreByWaiter = new Map<string, number | null>();
  for (const [waiterId, list] of groupPast(extras.previousAssignments ?? [], now)) {
    prevScoreByWaiter.set(waiterId, computeShiftStats(list).reliabilityScore);
  }

  const byWaiter = groupPast(assignments, now);
  const waiters: WaiterReliability[] = [];

  for (const [waiterId, list] of byWaiter) {
    const name = list.find((a) => a.waiterName)?.waiterName ?? null;
    const passport = passportByUser.get(waiterId);
    const s = computeShiftStats(list);

    const prevScore = prevScoreByWaiter.get(waiterId) ?? null;
    const reliabilityDelta =
      s.reliabilityScore !== null && prevScore !== null
        ? s.reliabilityScore - prevScore
        : null;

    waiters.push({
      waiterId,
      name,
      expectedShifts: s.expectedShifts,
      completedShifts: s.completedShifts,
      noShows: s.noShows,
      lateCancels: s.lateCancels,
      measurableShifts: s.measurableShifts,
      onTimeShifts: s.onTimeShifts,
      lateShifts: s.lateShifts,
      earlyExits: s.earlyExits,
      onTimePct: s.onTimePct,
      avgLateMinutes: s.avgLateMinutes,
      hoursWorked: s.hoursWorked,
      missingClockOuts: s.missingClockOuts,
      reliabilityScore: s.reliabilityScore,
      reliabilityDelta,
      guestRating: guestByWaiter.get(waiterId) ?? null,
      swapRequests: swapCountByWaiter.get(waiterId) ?? 0,
      activity: bucketActivity(list, windowStart, now),
      passportTier: passport?.passportTier ?? "FREE",
      sanitaryBookValid: passport?.sanitaryBookValid ?? false,
      sanitaryExpiry: passport?.sanitaryExpiry ? passport.sanitaryExpiry.toISOString() : null,
    });
  }

  // Rank: scored waiters first (desc), unscored (null) last, then by name.
  waiters.sort((a, b) => {
    const sa = a.reliabilityScore ?? -1;
    const sb = b.reliabilityScore ?? -1;
    if (sa !== sb) return sb - sa;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  const flags = buildFlags(waiters, now);

  const guestReviews = extras.guestReviews ?? [];
  const team: AnalyticsTeamSummary = {
    rosterSize: waiters.length,
    totalExpectedShifts: sum(waiters, (w) => w.expectedShifts),
    totalCompleted:      sum(waiters, (w) => w.completedShifts),
    totalNoShows:        sum(waiters, (w) => w.noShows),
    teamOnTimePct: teamOnTime(waiters),
    totalHours: round1(sum(waiters, (w) => w.hoursWorked)),
    teamGuestRating: guestReviews.length
      ? Math.round(guestReviews.reduce((s, r) => s + r.overallRating, 0) / guestReviews.length)
      : null,
    teamGuestReviewCount: guestReviews.length,
  };

  return { period, team, waiters, flags };
}

function buildFlags(waiters: WaiterReliability[], now: Date): WaiterFlag[] {
  const flags: WaiterFlag[] = [];
  const warnMs = SANITARY_WARN_DAYS * 24 * 3_600_000;

  for (const w of waiters) {
    if (w.noShows >= 2) {
      flags.push({ waiterId: w.waiterId, name: w.name, kind: "NO_SHOWS", detail: `${w.noShows} nedolaska` });
    }
    if (w.lateCancels >= 2) {
      flags.push({ waiterId: w.waiterId, name: w.name, kind: "LATE_CANCELS", detail: `${w.lateCancels} kasnih otkaza` });
    }
    if (w.swapRequests >= SWAP_CHURN_THRESHOLD) {
      flags.push({ waiterId: w.waiterId, name: w.name, kind: "SWAP_CHURN", detail: `${w.swapRequests} zahteva za zamenu` });
    }
    if (w.reliabilityScore !== null && w.reliabilityScore < 50) {
      flags.push({ waiterId: w.waiterId, name: w.name, kind: "LOW_RELIABILITY", detail: `Pouzdanost ${w.reliabilityScore}` });
    }
    if (!w.sanitaryBookValid) {
      flags.push({ waiterId: w.waiterId, name: w.name, kind: "SANITARY_INVALID", detail: "Sanitarna nije važeća" });
    } else if (w.sanitaryExpiry) {
      const exp = new Date(w.sanitaryExpiry).getTime();
      if (exp - now.getTime() <= warnMs) {
        const days = Math.ceil((exp - now.getTime()) / (24 * 3_600_000));
        flags.push({
          waiterId: w.waiterId,
          name: w.name,
          kind: "SANITARY_EXPIRING",
          detail: days <= 0 ? "Sanitarna istekla" : `Sanitarna ističe za ${days}d`,
        });
      }
    }
  }
  return flags;
}

function teamOnTime(waiters: WaiterReliability[]): number | null {
  let onTime = 0;
  let measurable = 0;
  for (const w of waiters) {
    onTime += w.onTimeShifts;
    measurable += w.measurableShifts;
  }
  return measurable > 0 ? Math.round((onTime / measurable) * 100) : null;
}

function sum<T>(arr: T[], pick: (t: T) => number): number {
  let s = 0;
  for (const t of arr) s += pick(t);
  return s;
}
