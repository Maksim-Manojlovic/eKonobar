import { describe, it, expect } from "vitest";
import { getEffectiveTier, isPro, isProPlus, tierRank } from "../passport-tier";

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const PAST   = new Date(Date.now() - 1);

describe("getEffectiveTier", () => {
  it("null passport → FREE", () => expect(getEffectiveTier(null)).toBe("FREE"));
  it("undefined passport → FREE", () => expect(getEffectiveTier(undefined)).toBe("FREE"));

  it("FREE tier → FREE regardless of expiry", () => {
    expect(getEffectiveTier({ passportTier: "FREE", subscriptionExpiresAt: FUTURE })).toBe("FREE");
    expect(getEffectiveTier({ passportTier: "FREE", subscriptionExpiresAt: null })).toBe("FREE");
  });

  it("PRO with null expiry → FREE (no active subscription)", () => {
    expect(getEffectiveTier({ passportTier: "PRO", subscriptionExpiresAt: null })).toBe("FREE");
  });

  it("PRO with past expiry → FREE", () => {
    expect(getEffectiveTier({ passportTier: "PRO", subscriptionExpiresAt: PAST })).toBe("FREE");
  });

  it("PRO with future expiry → PRO", () => {
    expect(getEffectiveTier({ passportTier: "PRO", subscriptionExpiresAt: FUTURE })).toBe("PRO");
  });

  it("PRO_PLUS with future expiry → PRO_PLUS", () => {
    expect(getEffectiveTier({ passportTier: "PRO_PLUS", subscriptionExpiresAt: FUTURE })).toBe("PRO_PLUS");
  });

  it("PRO_PLUS with past expiry → FREE", () => {
    expect(getEffectiveTier({ passportTier: "PRO_PLUS", subscriptionExpiresAt: PAST })).toBe("FREE");
  });
});

describe("isPro", () => {
  it("null → false", () => expect(isPro(null)).toBe(false));
  it("FREE → false", () => expect(isPro({ passportTier: "FREE", subscriptionExpiresAt: FUTURE })).toBe(false));
  it("PRO active → true", () => expect(isPro({ passportTier: "PRO", subscriptionExpiresAt: FUTURE })).toBe(true));
  it("PRO_PLUS active → true", () => expect(isPro({ passportTier: "PRO_PLUS", subscriptionExpiresAt: FUTURE })).toBe(true));
  it("PRO expired → false", () => expect(isPro({ passportTier: "PRO", subscriptionExpiresAt: PAST })).toBe(false));
});

describe("isProPlus", () => {
  it("null → false", () => expect(isProPlus(null)).toBe(false));
  it("PRO active → false", () => expect(isProPlus({ passportTier: "PRO", subscriptionExpiresAt: FUTURE })).toBe(false));
  it("PRO_PLUS active → true", () => expect(isProPlus({ passportTier: "PRO_PLUS", subscriptionExpiresAt: FUTURE })).toBe(true));
  it("PRO_PLUS expired → false", () => expect(isProPlus({ passportTier: "PRO_PLUS", subscriptionExpiresAt: PAST })).toBe(false));
});

describe("tierRank", () => {
  it("null → 0", () => expect(tierRank(null)).toBe(0));
  it("FREE → 0", () => expect(tierRank({ passportTier: "FREE", subscriptionExpiresAt: FUTURE })).toBe(0));
  it("PRO active → 1", () => expect(tierRank({ passportTier: "PRO", subscriptionExpiresAt: FUTURE })).toBe(1));
  it("PRO_PLUS active → 2", () => expect(tierRank({ passportTier: "PRO_PLUS", subscriptionExpiresAt: FUTURE })).toBe(2));
  it("PRO expired → 0", () => expect(tierRank({ passportTier: "PRO", subscriptionExpiresAt: PAST })).toBe(0));
});
