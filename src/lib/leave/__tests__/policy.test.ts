import { describe, it, expect } from "vitest";
import type { LeavePolicy } from "@prisma/client";
import {
  DEFAULT_POLICY, resolvePolicy, effectiveMaxOff, isFullyBlocked,
  hasCapacity, proRatedEntitlement, policyDepartments,
} from "../policy";
import { parseDateOnly } from "../dates";

const d = (s: string) => parseDateOnly(s)!;

const storedPolicy = (over: Partial<LeavePolicy> = {}) => ({
  id: "p1", venueId: "v1", department: "FOH",
  annualDays: 20, maxConcurrentOff: 4, minNoticeDays: 7,
  autoApprove: false, countWeekends: false,
  allowCarryOver: false, carryOverDays: 0, carryOverDeadline: "03-31",
  createdAt: new Date(), updatedAt: new Date(),
  ...over,
}) as LeavePolicy;

describe("resolvePolicy", () => {
  it("falls back to defaults when the venue has never configured one", () => {
    expect(resolvePolicy(null)).toEqual(DEFAULT_POLICY);
    expect(resolvePolicy(undefined)).toEqual(DEFAULT_POLICY);
  });

  it("returns a copy, so a caller cannot mutate the shared defaults", () => {
    const a = resolvePolicy(null);
    a.annualDays = 999;
    expect(resolvePolicy(null).annualDays).toBe(DEFAULT_POLICY.annualDays);
    expect(DEFAULT_POLICY.annualDays).toBe(26);
  });

  it("uses stored values over defaults", () => {
    expect(resolvePolicy(storedPolicy())).toEqual({
      annualDays: 20, maxConcurrentOff: 4, minNoticeDays: 7,
      autoApprove: false, countWeekends: false,
      allowCarryOver: false, carryOverDays: 0, carryOverDeadline: "03-31",
    });
  });

  it("does not treat a stored `false` as absent", () => {
    // The `||` bug: `false || true` would flip autoApprove back on for a venue
    // that deliberately turned it off.
    expect(resolvePolicy(storedPolicy({ autoApprove: false })).autoApprove).toBe(false);
    expect(resolvePolicy(storedPolicy({ countWeekends: false })).countWeekends).toBe(false);
  });

  it("does not treat a stored 0 as absent", () => {
    expect(resolvePolicy(storedPolicy({ maxConcurrentOff: 0 })).maxConcurrentOff).toBe(0);
  });
});

describe("effectiveMaxOff", () => {
  const policy = resolvePolicy(null); // maxConcurrentOff: 2

  it("uses the policy default when there is no blackout row", () => {
    expect(effectiveMaxOff(policy, null)).toBe(2);
  });

  it("lets a blackout row override the default", () => {
    expect(effectiveMaxOff(policy, { maxOff: 1 })).toBe(1);
  });

  it("treats maxOff 0 as a full block, not as absent", () => {
    // This is the owner's "X". If 0 were read as missing, X would do nothing.
    expect(effectiveMaxOff(policy, { maxOff: 0 })).toBe(0);
  });

  it("can raise the cap above the default for a busy day", () => {
    expect(effectiveMaxOff(policy, { maxOff: 5 })).toBe(5);
  });
});

describe("isFullyBlocked", () => {
  const policy = resolvePolicy(null);

  it("is true only when nobody may be off", () => {
    expect(isFullyBlocked(policy, { maxOff: 0 })).toBe(true);
    expect(isFullyBlocked(policy, { maxOff: 1 })).toBe(false);
    expect(isFullyBlocked(policy, null)).toBe(false);
  });

  it("is true when the policy itself allows nobody off", () => {
    expect(isFullyBlocked(resolvePolicy(storedPolicy({ maxConcurrentOff: 0 })), null)).toBe(true);
  });
});

describe("hasCapacity", () => {
  const policy = resolvePolicy(null); // cap 2

  it("allows up to the cap and refuses beyond it", () => {
    expect(hasCapacity(policy, null, 0)).toBe(true);
    expect(hasCapacity(policy, null, 1)).toBe(true);
    expect(hasCapacity(policy, null, 2)).toBe(false);
    expect(hasCapacity(policy, null, 3)).toBe(false);
  });

  it("refuses everyone on a fully blocked day", () => {
    expect(hasCapacity(policy, { maxOff: 0 }, 0)).toBe(false);
  });

  it("respects a blackout row that reduces the cap", () => {
    expect(hasCapacity(policy, { maxOff: 1 }, 0)).toBe(true);
    expect(hasCapacity(policy, { maxOff: 1 }, 1)).toBe(false);
  });
});

describe("proRatedEntitlement", () => {
  it("gives the full entitlement to someone who started in an earlier year", () => {
    expect(proRatedEntitlement(26, d("2020-05-01"), 2026)).toBe(26);
  });

  it("gives nothing for a start date after the leave year", () => {
    expect(proRatedEntitlement(26, d("2027-01-01"), 2026)).toBe(0);
  });

  it("gives the full entitlement for a January start", () => {
    expect(proRatedEntitlement(24, d("2026-01-15"), 2026)).toBe(24);
  });

  it("halves the entitlement for a July start", () => {
    // July is month index 6 → 6 months remaining → half of 24.
    expect(proRatedEntitlement(24, d("2026-07-01"), 2026)).toBe(12);
  });

  it("gives one month's worth for a December start", () => {
    expect(proRatedEntitlement(24, d("2026-12-20"), 2026)).toBe(2);
  });

  it("rounds rather than truncating", () => {
    // 26 * 6/12 = 13 exactly; 26 * 7/12 = 15.17 → 15.
    expect(proRatedEntitlement(26, d("2026-07-01"), 2026)).toBe(13);
    expect(proRatedEntitlement(26, d("2026-06-01"), 2026)).toBe(15);
  });
});

describe("policyDepartments", () => {
  it("returns FOH only for a venue with no kitchen", () => {
    expect(policyDepartments(false)).toEqual(["FOH"]);
  });

  it("returns both departments for a venue with a kitchen", () => {
    expect(policyDepartments(true)).toEqual(["FOH", "BOH"]);
  });
});
