import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/core/db", () => ({
  db: {
    shift:         { findUnique: vi.fn() },
    shiftTemplate: { findUnique: vi.fn() },
  },
}));

import { db } from "@/lib/core/db";
import { canManageShifts, getManagedShift, getManagedTemplate } from "../auth";

const VENUE = { id: "v-1", ownerId: "owner-1", headWaiterId: "hw-1" };

describe("canManageShifts", () => {
  it("VENUE_OWNER with matching ownerId -> true", () => {
    expect(canManageShifts("owner-1", "VENUE_OWNER", VENUE)).toBe(true);
  });

  it("VENUE_OWNER with wrong id -> false", () => {
    expect(canManageShifts("other", "VENUE_OWNER", VENUE)).toBe(false);
  });

  it("WAITER as headWaiter -> true", () => {
    expect(canManageShifts("hw-1", "WAITER", VENUE)).toBe(true);
  });

  it("WAITER not headWaiter -> false", () => {
    expect(canManageShifts("other-waiter", "WAITER", VENUE)).toBe(false);
  });

  it("WAITER when headWaiterId is null -> false", () => {
    expect(canManageShifts("hw-1", "WAITER", { ...VENUE, headWaiterId: null })).toBe(false);
  });

  it("ADMIN role -> false (not in allowed roles)", () => {
    expect(canManageShifts("owner-1", "ADMIN", VENUE)).toBe(false);
  });
});

describe("getManagedShift", () => {
  beforeEach(() => vi.clearAllMocks());

  const SHIFT = {
    id: "s-1",
    venue: VENUE,
    assignments: [],
  };

  it("shift exists + owner authorized -> returns shift", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue(SHIFT as never);
    const result = await getManagedShift("s-1", "owner-1", "VENUE_OWNER");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("s-1");
  });

  it("shift not found -> null", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue(null);
    const result = await getManagedShift("bad", "owner-1", "VENUE_OWNER");
    expect(result).toBeNull();
  });

  it("wrong owner -> null", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue(SHIFT as never);
    const result = await getManagedShift("s-1", "other", "VENUE_OWNER");
    expect(result).toBeNull();
  });

  it("headWaiter authorized -> returns shift", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue(SHIFT as never);
    const result = await getManagedShift("s-1", "hw-1", "WAITER");
    expect(result).not.toBeNull();
  });
});

describe("getManagedTemplate", () => {
  beforeEach(() => vi.clearAllMocks());

  const TEMPLATE = { id: "t-1", venue: VENUE };

  it("template exists + owner authorized -> returns template", async () => {
    vi.mocked(db.shiftTemplate.findUnique).mockResolvedValue(TEMPLATE as never);
    const result = await getManagedTemplate("t-1", "owner-1", "VENUE_OWNER");
    expect(result).not.toBeNull();
  });

  it("template not found -> null", async () => {
    vi.mocked(db.shiftTemplate.findUnique).mockResolvedValue(null);
    const result = await getManagedTemplate("bad", "owner-1", "VENUE_OWNER");
    expect(result).toBeNull();
  });

  it("wrong owner -> null", async () => {
    vi.mocked(db.shiftTemplate.findUnique).mockResolvedValue(TEMPLATE as never);
    const result = await getManagedTemplate("t-1", "other", "VENUE_OWNER");
    expect(result).toBeNull();
  });
});
