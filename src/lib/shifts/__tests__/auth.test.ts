import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/core/db", () => ({
  db: { shift: { findUnique: vi.fn() }, shiftTemplate: { findUnique: vi.fn() } },
}));

import { canManageShifts, canManageDepartment, departmentOfShift } from "../auth";

const VENUE = { ownerId: "owner-1", headWaiterId: "hw-1", headChefId: "chef-1" };

describe("departmentOfShift", () => {
  it("reads a null department as FOH", () => {
    // Every shift predating the column is front-of-house: the platform had no
    // kitchen staff until departments existed. Null is not "unscoped".
    expect(departmentOfShift({ department: null })).toBe("FOH");
  });

  it("passes an explicit department through", () => {
    expect(departmentOfShift({ department: "BOH" })).toBe("BOH");
    expect(departmentOfShift({ department: "FOH" })).toBe("FOH");
  });
});

describe("canManageShifts", () => {
  it("allows the owner", () => {
    expect(canManageShifts("owner-1", "VENUE_OWNER", VENUE)).toBe(true);
  });

  it("rejects a different owner", () => {
    expect(canManageShifts("owner-2", "VENUE_OWNER", VENUE)).toBe(false);
  });

  it("allows either head, unscoped", () => {
    expect(canManageShifts("hw-1", "WAITER", VENUE)).toBe(true);
    expect(canManageShifts("chef-1", "WAITER", VENUE)).toBe(true);
  });

  it("rejects an unrelated waiter", () => {
    expect(canManageShifts("waiter-9", "WAITER", VENUE)).toBe(false);
  });

  it("rejects other roles outright", () => {
    expect(canManageShifts("hh-1", "HEADHUNTER", VENUE)).toBe(false);
    expect(canManageShifts("owner-1", "HEADHUNTER", VENUE)).toBe(false);
  });

  it("still works for callers that never select headChefId", () => {
    // Existing call sites select only ownerId + headWaiterId.
    expect(canManageShifts("hw-1", "WAITER", { ownerId: "owner-1", headWaiterId: "hw-1" })).toBe(true);
    expect(canManageShifts("chef-1", "WAITER", { ownerId: "owner-1", headWaiterId: "hw-1" })).toBe(false);
  });
});

describe("canManageDepartment", () => {
  it("lets the owner manage both departments", () => {
    expect(canManageDepartment("owner-1", "VENUE_OWNER", VENUE, "FOH")).toBe(true);
    expect(canManageDepartment("owner-1", "VENUE_OWNER", VENUE, "BOH")).toBe(true);
  });

  it("confines the head waiter to the floor", () => {
    expect(canManageDepartment("hw-1", "WAITER", VENUE, "FOH")).toBe(true);
    expect(canManageDepartment("hw-1", "WAITER", VENUE, "BOH")).toBe(false);
  });

  it("confines the head chef to the kitchen", () => {
    // Without this, appointing a head chef would hand them the floor rota too.
    expect(canManageDepartment("chef-1", "WAITER", VENUE, "BOH")).toBe(true);
    expect(canManageDepartment("chef-1", "WAITER", VENUE, "FOH")).toBe(false);
  });

  it("rejects an unrelated waiter in both departments", () => {
    expect(canManageDepartment("waiter-9", "WAITER", VENUE, "FOH")).toBe(false);
    expect(canManageDepartment("waiter-9", "WAITER", VENUE, "BOH")).toBe(false);
  });

  it("gives the head waiter legacy FOH shifts", () => {
    // A null-department shift resolves to FOH, so the head waiter keeps the
    // access they had before departments existed.
    const legacy = departmentOfShift({ department: null });
    expect(canManageDepartment("hw-1", "WAITER", VENUE, legacy)).toBe(true);
    expect(canManageDepartment("chef-1", "WAITER", VENUE, legacy)).toBe(false);
  });

  it("handles a venue with no head chef appointed", () => {
    const noChef = { ownerId: "owner-1", headWaiterId: "hw-1", headChefId: null };
    expect(canManageDepartment("hw-1", "WAITER", noChef, "BOH")).toBe(false);
    expect(canManageDepartment("owner-1", "VENUE_OWNER", noChef, "BOH")).toBe(true);
  });
});
