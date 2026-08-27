import { describe, it, expect } from "vitest";
import type { Session } from "next-auth";

import {
  getRedAlertCutoff,
  redAlertVisibilityFilter,
  isRedAlertEmbargoed,
} from "../red-alert";
import { RED_ALERT_DELAY_MS } from "../constants";

const session = (role: string, id = "u-1") =>
  ({ user: { id, role } }) as unknown as Session;

describe("getRedAlertCutoff", () => {
  it("unauthenticated → cutoff applied (public surfaces must not serve fresh Red Alerts)", () => {
    expect(getRedAlertCutoff(null)).toBeInstanceOf(Date);
  });

  it.each(["WAITER", "VENUE_OWNER", "HEADHUNTER", "ADMIN"])(
    "signed-in %s → no cutoff",
    (role) => {
      expect(getRedAlertCutoff(session(role))).toBeUndefined();
    },
  );

  it("cutoff is exactly RED_ALERT_DELAY_MS in the past", () => {
    const before = Date.now();
    const cutoff = getRedAlertCutoff(null) as Date;
    const after = Date.now();
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - RED_ALERT_DELAY_MS);
    expect(cutoff.getTime()).toBeLessThanOrEqual(after - RED_ALERT_DELAY_MS);
  });
});

describe("redAlertVisibilityFilter", () => {
  it("no cutoff → empty array (spreads to nothing under AND)", () => {
    expect(redAlertVisibilityFilter(undefined)).toEqual([]);
  });

  it("cutoff → non-redAlert posts OR redAlert posts older than cutoff", () => {
    const cutoff = new Date("2026-01-01T00:00:00Z");
    expect(redAlertVisibilityFilter(cutoff)).toEqual([
      { OR: [{ redAlert: false }, { redAlert: true, createdAt: { lte: cutoff } }] },
    ]);
  });

  it("returns an array, never a bare OR object", () => {
    // A bare `{ OR }` spread alongside a search `{ OR }` silently drops one of
    // them — duplicate keys overwrite. Composing under AND is what prevents it.
    const out = redAlertVisibilityFilter(new Date());
    expect(Array.isArray(out)).toBe(true);
    expect(out).not.toHaveProperty("OR");
  });
});

describe("isRedAlertEmbargoed", () => {
  const cutoff = new Date("2026-01-01T00:00:00Z");
  const before = new Date("2025-12-31T23:00:00Z"); // older than cutoff
  const after  = new Date("2026-01-01T00:30:00Z"); // newer than cutoff

  it("no cutoff → never embargoed", () => {
    expect(isRedAlertEmbargoed({ redAlert: true, createdAt: after }, undefined)).toBe(false);
  });

  it("fresh Red Alert inside window → embargoed", () => {
    expect(isRedAlertEmbargoed({ redAlert: true, createdAt: after }, cutoff)).toBe(true);
  });

  it("Red Alert older than cutoff → not embargoed", () => {
    expect(isRedAlertEmbargoed({ redAlert: true, createdAt: before }, cutoff)).toBe(false);
  });

  it("non-Red-Alert post → never embargoed regardless of age", () => {
    expect(isRedAlertEmbargoed({ redAlert: false, createdAt: after }, cutoff)).toBe(false);
  });

  it("post exactly at cutoff → not embargoed (boundary matches the lte query)", () => {
    expect(isRedAlertEmbargoed({ redAlert: true, createdAt: cutoff }, cutoff)).toBe(false);
  });
});
