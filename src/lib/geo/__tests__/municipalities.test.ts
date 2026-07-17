import { describe, it, expect } from "vitest";
import {
  BELGRADE_MUNICIPALITIES,
  isKnownMunicipality,
  sanitizeMunicipalities,
} from "../municipalities";

describe("BELGRADE_MUNICIPALITIES", () => {
  it("has the 17 official gradske opštine", () => {
    expect(BELGRADE_MUNICIPALITIES).toHaveLength(17);
  });

  it("has no duplicates", () => {
    expect(new Set(BELGRADE_MUNICIPALITIES).size).toBe(BELGRADE_MUNICIPALITIES.length);
  });

  it("leads with the urban core", () => {
    expect(BELGRADE_MUNICIPALITIES[0]).toBe("Stari grad");
    expect(BELGRADE_MUNICIPALITIES.slice(0, 4)).toContain("Vračar");
  });
});

describe("isKnownMunicipality", () => {
  it("accepts canonical names", () => {
    expect(isKnownMunicipality("Vračar")).toBe(true);
    expect(isKnownMunicipality("Novi Beograd")).toBe(true);
  });

  it("rejects unknown or mis-cased names", () => {
    expect(isKnownMunicipality("Atlantis")).toBe(false);
    expect(isKnownMunicipality("vračar")).toBe(false); // casing must match
    expect(isKnownMunicipality("")).toBe(false);
  });
});

describe("sanitizeMunicipalities", () => {
  it("keeps only recognised names", () => {
    expect(sanitizeMunicipalities(["Vračar", "Atlantis", "Zemun"])).toEqual(["Vračar", "Zemun"]);
  });

  it("trims surrounding whitespace before matching", () => {
    expect(sanitizeMunicipalities(["  Vračar  "])).toEqual(["Vračar"]);
  });

  it("de-duplicates", () => {
    expect(sanitizeMunicipalities(["Vračar", "Vračar", "Zemun"])).toEqual(["Vračar", "Zemun"]);
  });

  it("returns canonical order regardless of input order", () => {
    // Zemun (index 9) comes after Vračar (index 1) in the canonical list.
    expect(sanitizeMunicipalities(["Zemun", "Vračar"])).toEqual(["Vračar", "Zemun"]);
  });

  it("empty input → empty array", () => {
    expect(sanitizeMunicipalities([])).toEqual([]);
  });

  it("all-junk input → empty array (nothing persisted)", () => {
    expect(sanitizeMunicipalities(["nope", "", "   "])).toEqual([]);
  });
});
