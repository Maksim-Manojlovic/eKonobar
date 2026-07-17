import { describe, it, expect } from "vitest";
import { buildWaiterQuery } from "@/hooks/useWaiterSearch";

describe("buildWaiterQuery", () => {
  it("returns empty string for no filters", () => {
    expect(buildWaiterQuery({})).toBe("");
  });

  it("omits empty / falsy values", () => {
    expect(buildWaiterQuery({ search: "", minScore: "", available: false, sanitaryBook: false })).toBe("");
  });

  it("sets boolean flags as 'true' only when enabled", () => {
    expect(buildWaiterQuery({ available: true, sanitaryBook: true })).toBe("available=true&sanitaryBook=true");
  });

  it("stringifies numeric filters", () => {
    expect(buildWaiterQuery({ minScore: 70, minExperience: 3 })).toBe("minScore=70&minExperience=3");
  });

  it("sets municipality when present", () => {
    expect(new URLSearchParams(buildWaiterQuery({ municipality: "Vračar" })).get("municipality")).toBe("Vračar");
  });

  it("omits municipality when empty", () => {
    expect(buildWaiterQuery({ municipality: "" })).toBe("");
  });

  it("builds the full headhunter query", () => {
    const qs = new URLSearchParams(
      buildWaiterQuery({
        search: "marko",
        minScore: "50",
        verificationTier: "GOLD",
        available: true,
        sanitaryBook: true,
        minExperience: "2",
        skills: "cocktail,sommelier",
      }),
    );
    expect(qs.get("search")).toBe("marko");
    expect(qs.get("minScore")).toBe("50");
    expect(qs.get("verificationTier")).toBe("GOLD");
    expect(qs.get("available")).toBe("true");
    expect(qs.get("sanitaryBook")).toBe("true");
    expect(qs.get("minExperience")).toBe("2");
    expect(qs.get("skills")).toBe("cocktail,sommelier");
  });
});
