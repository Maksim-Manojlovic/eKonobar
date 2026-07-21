import { describe, it, expect } from "vitest";
import type { StaffPosition, VenueType } from "@prisma/client";
import {
  POSITION_DEPARTMENT,
  departmentOf,
  FOH_POSITIONS,
  BOH_POSITIONS,
  positionsForDepartment,
  KITCHEN_VENUE_TYPES,
  hasKitchen,
  departmentsForVenue,
  isPositionAllowedAtVenue,
  HEAD_POSITIONS,
  isHeadPosition,
} from "../positions";
import { POSITION_LABELS } from "@/lib/formatting/display-maps";

const ALL_POSITIONS = Object.keys(POSITION_DEPARTMENT) as StaffPosition[];

describe("POSITION_DEPARTMENT", () => {
  it("maps every position to exactly one department", () => {
    for (const p of ALL_POSITIONS) {
      expect(["FOH", "BOH"]).toContain(POSITION_DEPARTMENT[p]);
    }
  });

  it("puts kitchen roles in BOH", () => {
    expect(departmentOf("HEAD_CHEF")).toBe("BOH");
    expect(departmentOf("LINE_COOK")).toBe("BOH");
    expect(departmentOf("DISHWASHER")).toBe("BOH");
  });

  it("puts floor roles in FOH", () => {
    expect(departmentOf("WAITER")).toBe("FOH");
    expect(departmentOf("HEAD_WAITER")).toBe("FOH");
    expect(departmentOf("BARTENDER")).toBe("FOH");
  });
});

describe("FOH_POSITIONS / BOH_POSITIONS", () => {
  // These lists drive the pickers. If a position exists in the enum but is in
  // neither list it becomes unassignable — silently invisible in the UI.
  it("together cover every position with no overlap", () => {
    const combined = [...FOH_POSITIONS, ...BOH_POSITIONS];
    expect(new Set(combined).size).toBe(combined.length);
    expect(combined.sort()).toEqual([...ALL_POSITIONS].sort());
  });

  it("agrees with POSITION_DEPARTMENT", () => {
    for (const p of FOH_POSITIONS) expect(departmentOf(p)).toBe("FOH");
    for (const p of BOH_POSITIONS) expect(departmentOf(p)).toBe("BOH");
  });

  it("leads each department with its head position", () => {
    expect(FOH_POSITIONS[0]).toBe("HEAD_WAITER");
    expect(BOH_POSITIONS[0]).toBe("HEAD_CHEF");
  });

  it("positionsForDepartment returns the matching list", () => {
    expect(positionsForDepartment("FOH")).toEqual(FOH_POSITIONS);
    expect(positionsForDepartment("BOH")).toEqual(BOH_POSITIONS);
  });
});

describe("hasKitchen", () => {
  it("is true for kitchen venue types by default", () => {
    for (const t of KITCHEN_VENUE_TYPES) {
      expect(hasKitchen({ venueType: t, kitchenEnabled: null })).toBe(true);
    }
  });

  it("is false for cafés, bars and event spaces by default", () => {
    for (const t of ["CAFE", "BAR", "EVENT"] as VenueType[]) {
      expect(hasKitchen({ venueType: t, kitchenEnabled: null })).toBe(false);
    }
  });

  it("treats a missing kitchenEnabled the same as null", () => {
    expect(hasKitchen({ venueType: "RESTAURANT" })).toBe(true);
    expect(hasKitchen({ venueType: "CAFE" })).toBe(false);
  });

  it("lets an explicit override win in both directions", () => {
    // A bar that started serving food.
    expect(hasKitchen({ venueType: "BAR", kitchenEnabled: true })).toBe(true);
    // A restaurant that outsources its kitchen.
    expect(hasKitchen({ venueType: "RESTAURANT", kitchenEnabled: false })).toBe(false);
  });

  it("does not treat `false` as absent", () => {
    // Guards the `??` vs `||` mistake — `false || fallback` would wrongly
    // re-enable the kitchen for a restaurant that explicitly turned it off.
    expect(hasKitchen({ venueType: "HOTEL", kitchenEnabled: false })).toBe(false);
  });
});

describe("departmentsForVenue", () => {
  it("always includes FOH", () => {
    for (const t of ["RESTAURANT", "CAFE", "BAR", "HOTEL", "CATERING", "EVENT"] as VenueType[]) {
      expect(departmentsForVenue({ venueType: t })).toContain("FOH");
    }
  });

  it("adds BOH only when the venue has a kitchen", () => {
    expect(departmentsForVenue({ venueType: "RESTAURANT" })).toEqual(["FOH", "BOH"]);
    expect(departmentsForVenue({ venueType: "CAFE" })).toEqual(["FOH"]);
  });
});

describe("isPositionAllowedAtVenue", () => {
  it("rejects a kitchen position at a venue with no kitchen", () => {
    expect(isPositionAllowedAtVenue("HEAD_CHEF", { venueType: "CAFE" })).toBe(false);
    expect(isPositionAllowedAtVenue("LINE_COOK", { venueType: "BAR" })).toBe(false);
  });

  it("allows kitchen positions at a restaurant", () => {
    expect(isPositionAllowedAtVenue("HEAD_CHEF", { venueType: "RESTAURANT" })).toBe(true);
  });

  it("allows floor positions everywhere", () => {
    expect(isPositionAllowedAtVenue("WAITER", { venueType: "CAFE" })).toBe(true);
    expect(isPositionAllowedAtVenue("WAITER", { venueType: "RESTAURANT" })).toBe(true);
  });

  it("honours the kitchenEnabled override", () => {
    expect(isPositionAllowedAtVenue("LINE_COOK", { venueType: "BAR", kitchenEnabled: true })).toBe(true);
    expect(isPositionAllowedAtVenue("LINE_COOK", { venueType: "RESTAURANT", kitchenEnabled: false })).toBe(false);
  });
});

describe("head positions", () => {
  it("maps each department to its head position", () => {
    expect(HEAD_POSITIONS.FOH).toBe("HEAD_WAITER");
    expect(HEAD_POSITIONS.BOH).toBe("HEAD_CHEF");
  });

  it("head position belongs to the department it leads", () => {
    expect(departmentOf(HEAD_POSITIONS.FOH)).toBe("FOH");
    expect(departmentOf(HEAD_POSITIONS.BOH)).toBe("BOH");
  });

  it("isHeadPosition is true only for the two head roles", () => {
    for (const p of ALL_POSITIONS) {
      expect(isHeadPosition(p)).toBe(p === "HEAD_WAITER" || p === "HEAD_CHEF");
    }
  });
});

describe("POSITION_LABELS", () => {
  it("has a Serbian label for every position", () => {
    // A missing label renders a raw enum value like "PREP_COOK" in the UI.
    for (const p of ALL_POSITIONS) {
      expect(POSITION_LABELS[p], `missing label for ${p}`).toBeTruthy();
    }
  });
});
