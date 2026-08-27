import { describe, it, expect } from "vitest";
import {
  decideLeaveRequest, deductsFromBalance, bypassesCapacity,
  PENDING_REASON_LABELS, type DecisionInput,
} from "../request";
import { DEFAULT_POLICY } from "../policy";

/** A request that clears every check, so each test changes exactly one thing. */
function input(over: Partial<DecisionInput> = {}): DecisionInput {
  return {
    type: "ANNUAL",
    policy: { ...DEFAULT_POLICY },
    days: 3,
    dates: ["2026-08-10", "2026-08-11", "2026-08-12"],
    blackouts: new Map(),
    offCounts: new Map(),
    balanceRemaining: 26,
    noticeDays: 30,
    filedByManager: false,
    ...over,
  };
}

describe("deductsFromBalance", () => {
  it("is true only for annual leave", () => {
    expect(deductsFromBalance("ANNUAL")).toBe(true);
    for (const t of ["SICK", "UNPAID", "PARENTAL", "SPECIAL"] as const) {
      expect(deductsFromBalance(t), t).toBe(false);
    }
  });
});

describe("bypassesCapacity", () => {
  it("is true only for sick leave", () => {
    expect(bypassesCapacity("SICK")).toBe(true);
    for (const t of ["ANNUAL", "UNPAID", "PARENTAL", "SPECIAL"] as const) {
      expect(bypassesCapacity(t), t).toBe(false);
    }
  });
});

describe("decideLeaveRequest — happy path", () => {
  it("approves a request that clears every check", () => {
    expect(decideLeaveRequest(input())).toEqual({ outcome: "APPROVED" });
  });
});

describe("decideLeaveRequest — sick leave", () => {
  it("approves immediately when a manager files it", () => {
    expect(decideLeaveRequest(input({ type: "SICK", filedByManager: true })))
      .toEqual({ outcome: "APPROVED" });
  });

  it("queues a worker's own sick note for confirmation", () => {
    expect(decideLeaveRequest(input({ type: "SICK", filedByManager: false })))
      .toEqual({ outcome: "PENDING", reason: "SICK_NEEDS_CONFIRMATION" });
  });

  it("ignores a fully blocked day — a sick person cannot be ordered in", () => {
    const decision = decideLeaveRequest(input({
      type: "SICK", filedByManager: true,
      blackouts: new Map([["2026-08-11", 0]]),
    }));
    expect(decision).toEqual({ outcome: "APPROVED" });
  });

  it("ignores a full capacity day", () => {
    const decision = decideLeaveRequest(input({
      type: "SICK", filedByManager: true,
      offCounts: new Map([["2026-08-10", 99]]),
    }));
    expect(decision).toEqual({ outcome: "APPROVED" });
  });

  it("ignores an empty balance", () => {
    const decision = decideLeaveRequest(input({
      type: "SICK", filedByManager: true, balanceRemaining: 0, days: 5,
    }));
    expect(decision).toEqual({ outcome: "APPROVED" });
  });

  it("ignores retroactive dates", () => {
    const decision = decideLeaveRequest(input({
      type: "SICK", filedByManager: true, noticeDays: -3,
    }));
    expect(decision).toEqual({ outcome: "APPROVED" });
  });
});

describe("decideLeaveRequest — blocked days", () => {
  it("rejects when any day in the range is fully blocked", () => {
    const decision = decideLeaveRequest(input({ blackouts: new Map([["2026-08-11", 0]]) }));
    expect(decision.outcome).toBe("REJECTED");
    if (decision.outcome === "REJECTED") {
      expect(decision.code).toBe("DAY_BLOCKED");
      expect(decision.message).toContain("2026-08-11");
    }
  });

  it("rejects rather than queues — a manager cannot override the venue's X", () => {
    const decision = decideLeaveRequest(input({ blackouts: new Map([["2026-08-10", 0]]) }));
    expect(decision.outcome).not.toBe("PENDING");
  });

  it("allows a day whose blackout row only reduces the cap", () => {
    const decision = decideLeaveRequest(input({ blackouts: new Map([["2026-08-11", 1]]) }));
    expect(decision).toEqual({ outcome: "APPROVED" });
  });

  it("rejects when the policy itself allows nobody off", () => {
    const decision = decideLeaveRequest(input({
      policy: { ...DEFAULT_POLICY, maxConcurrentOff: 0 },
    }));
    expect(decision.outcome).toBe("REJECTED");
  });
});

describe("decideLeaveRequest — balance", () => {
  it("rejects when the balance is short", () => {
    const decision = decideLeaveRequest(input({ days: 5, balanceRemaining: 3 }));
    expect(decision.outcome).toBe("REJECTED");
    if (decision.outcome === "REJECTED") expect(decision.code).toBe("INSUFFICIENT_BALANCE");
  });

  it("allows spending the balance down to exactly zero", () => {
    expect(decideLeaveRequest(input({ days: 3, balanceRemaining: 3 })))
      .toEqual({ outcome: "APPROVED" });
  });

  it("does not check the balance for unpaid leave", () => {
    expect(decideLeaveRequest(input({ type: "UNPAID", days: 10, balanceRemaining: 0 })))
      .toEqual({ outcome: "APPROVED" });
  });

  it("checks capacity for unpaid leave even though the balance is exempt", () => {
    const decision = decideLeaveRequest(input({
      type: "UNPAID", days: 10, balanceRemaining: 0,
      offCounts: new Map([["2026-08-10", 2]]),
    }));
    expect(decision).toEqual({ outcome: "PENDING", reason: "CAPACITY_FULL" });
  });
});

describe("decideLeaveRequest — capacity", () => {
  it("queues when a day has reached the cap", () => {
    const decision = decideLeaveRequest(input({ offCounts: new Map([["2026-08-11", 2]]) }));
    expect(decision).toEqual({ outcome: "PENDING", reason: "CAPACITY_FULL" });
  });

  it("approves when a day is at the cap minus one", () => {
    expect(decideLeaveRequest(input({ offCounts: new Map([["2026-08-11", 1]]) })))
      .toEqual({ outcome: "APPROVED" });
  });

  it("respects a blackout row that lowers the cap below the current count", () => {
    const decision = decideLeaveRequest(input({
      blackouts: new Map([["2026-08-12", 1]]),
      offCounts: new Map([["2026-08-12", 1]]),
    }));
    expect(decision).toEqual({ outcome: "PENDING", reason: "CAPACITY_FULL" });
  });

  it("queues rather than rejects — capacity is a judgement call", () => {
    const decision = decideLeaveRequest(input({ offCounts: new Map([["2026-08-10", 9]]) }));
    expect(decision.outcome).toBe("PENDING");
  });
});

describe("decideLeaveRequest — notice", () => {
  it("queues a request made with less notice than the policy requires", () => {
    expect(decideLeaveRequest(input({ noticeDays: 3 })))
      .toEqual({ outcome: "PENDING", reason: "SHORT_NOTICE" });
  });

  it("approves at exactly the required notice", () => {
    expect(decideLeaveRequest(input({ noticeDays: DEFAULT_POLICY.minNoticeDays })))
      .toEqual({ outcome: "APPROVED" });
  });

  it("queues a retroactive non-sick request rather than rejecting it", () => {
    expect(decideLeaveRequest(input({ noticeDays: -5 })))
      .toEqual({ outcome: "PENDING", reason: "SHORT_NOTICE" });
  });

  it("approves short notice when the policy requires none", () => {
    expect(decideLeaveRequest(input({
      noticeDays: 0, policy: { ...DEFAULT_POLICY, minNoticeDays: 0 },
    }))).toEqual({ outcome: "APPROVED" });
  });
});

describe("decideLeaveRequest — manual approval", () => {
  it("queues everything when the venue turned auto-approval off", () => {
    expect(decideLeaveRequest(input({ policy: { ...DEFAULT_POLICY, autoApprove: false } })))
      .toEqual({ outcome: "PENDING", reason: "MANUAL_APPROVAL" });
  });

  it("still rejects a blocked day rather than queueing it", () => {
    const decision = decideLeaveRequest(input({
      policy: { ...DEFAULT_POLICY, autoApprove: false },
      blackouts: new Map([["2026-08-10", 0]]),
    }));
    expect(decision.outcome).toBe("REJECTED");
  });
});

describe("rule precedence", () => {
  it("reports the blocked day when both a block and a short balance apply", () => {
    // The blocked day is the more fundamental "no" — reporting the balance
    // would send the worker off to free up days that still would not help.
    const decision = decideLeaveRequest(input({
      blackouts: new Map([["2026-08-10", 0]]),
      days: 10, balanceRemaining: 1,
    }));
    expect(decision.outcome).toBe("REJECTED");
    if (decision.outcome === "REJECTED") expect(decision.code).toBe("DAY_BLOCKED");
  });

  it("prefers a rejection over a queue when both apply", () => {
    const decision = decideLeaveRequest(input({
      days: 10, balanceRemaining: 1,
      offCounts: new Map([["2026-08-10", 5]]),
      noticeDays: 0,
    }));
    expect(decision.outcome).toBe("REJECTED");
  });

  it("reports capacity before notice when both apply", () => {
    const decision = decideLeaveRequest(input({
      offCounts: new Map([["2026-08-10", 5]]), noticeDays: 0,
    }));
    expect(decision).toEqual({ outcome: "PENDING", reason: "CAPACITY_FULL" });
  });
});

describe("PENDING_REASON_LABELS", () => {
  it("has a Serbian label for every pending reason", () => {
    const reasons = ["CAPACITY_FULL", "SHORT_NOTICE", "MANUAL_APPROVAL", "SICK_NEEDS_CONFIRMATION"] as const;
    for (const r of reasons) expect(PENDING_REASON_LABELS[r], r).toBeTruthy();
  });
});
