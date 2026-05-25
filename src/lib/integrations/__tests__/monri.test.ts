import { describe, it, expect, vi } from "vitest";
import { verifyCallback, callbackApproved } from "../monri";

// verifyCallback and callbackApproved are pure functions — no mocks needed.
// createPaymentSession / chargeStoredCard make real HTTP calls — not unit tested here.

describe("callbackApproved", () => {
  it("response_code 0000 + status approved -> true", () => {
    expect(callbackApproved({
      response_code: "0000",
      status: "approved",
      approval_code: "X",
      amount: "29000",
      currency: "RSD",
      order_number: "EK-1",
      digest: "abc",
    })).toBe(true);
  });

  it("response_code 0001 -> false", () => {
    expect(callbackApproved({
      response_code: "0001",
      status: "approved",
      approval_code: "X",
      amount: "29000",
      currency: "RSD",
      order_number: "EK-1",
      digest: "abc",
    })).toBe(false);
  });

  it("status declined -> false", () => {
    expect(callbackApproved({
      response_code: "0000",
      status: "declined",
      approval_code: "X",
      amount: "29000",
      currency: "RSD",
      order_number: "EK-1",
      digest: "abc",
    })).toBe(false);
  });
});

describe("verifyCallback", () => {
  it("returns false when MONRI_MERCHANT_KEY not set", () => {
    // env var not set in test environment -> MERCHANT_KEY is ""
    const result = verifyCallback({
      approval_code: "ABC",
      amount: "29000",
      currency: "RSD",
      order_number: "EK-1",
      response_code: "0000",
      status: "approved",
      digest: "whatever",
    });
    expect(result).toBe(false);
  });

  it("returns false for mismatched digest", () => {
    vi.stubEnv("MONRI_MERCHANT_KEY", "test-key");
    const result = verifyCallback({
      approval_code: "ABC",
      amount: "29000",
      currency: "RSD",
      order_number: "EK-1",
      response_code: "0000",
      status: "approved",
      digest: "wrong-digest",
    });
    expect(result).toBe(false);
  });
});
