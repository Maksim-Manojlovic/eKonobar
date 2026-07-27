import { describe, it, expect } from "vitest";
import { VenueType } from "@prisma/client";
import {
  VENUE_TYPE_LABELS,
  VENUE_TYPE_ICONS,
  VENUE_TYPE_OPTIONS,
} from "../display-maps";
import { VENUE_TYPE_MARKER } from "@/components/map/map-constants";

/**
 * Drift guard. Four hand-written venue-type lists existed before this file and
 * disagreed: two spelled a night club `NIGHT_CLUB` / `NIGHTCLUB` while the enum
 * had neither, so the value was pickable but matched no venue, and `EVENT` was
 * missing from both pickers. Every list is now derived from VENUE_TYPE_LABELS —
 * these tests fail the moment a new enum value is added without a label, icon
 * or marker, which is what makes the derivation safe to rely on.
 */
describe("venue type taxonomy", () => {
  const enumValues = Object.values(VenueType) as string[];

  it("labels cover exactly the VenueType enum", () => {
    expect(Object.keys(VENUE_TYPE_LABELS).sort()).toEqual([...enumValues].sort());
  });

  it("icons cover exactly the VenueType enum", () => {
    expect(Object.keys(VENUE_TYPE_ICONS).sort()).toEqual([...enumValues].sort());
  });

  it("map markers cover exactly the VenueType enum", () => {
    expect(Object.keys(VENUE_TYPE_MARKER).sort()).toEqual([...enumValues].sort());
  });

  it("marker colors are distinct — two types must never share a hue", () => {
    const hexes = Object.values(VENUE_TYPE_MARKER);
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  it("options derive from the labels, in enum order", () => {
    expect(VENUE_TYPE_OPTIONS).toEqual(
      Object.entries(VENUE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    );
  });

  it("every option has a non-empty Serbian label", () => {
    for (const { value, label } of VENUE_TYPE_OPTIONS) {
      expect(label.trim(), `empty label for ${value}`).not.toBe("");
    }
  });
});
