import { describe, it, expect } from "vitest";
import {
  NAV_LINKS_VENUE,
  FOOTER_LINKS,
  HERO_STATS,
  COMPARISON_ROWS,
  VENUE_FEATURES,
  faqItems,
} from "../content";

describe("for-venues content", () => {
  it("nav + footer links are non-empty and anchor/route-shaped", () => {
    expect(NAV_LINKS_VENUE.length).toBeGreaterThan(0);
    expect(FOOTER_LINKS.length).toBeGreaterThan(0);
    for (const l of [...NAV_LINKS_VENUE, ...FOOTER_LINKS]) {
      expect(typeof l.href).toBe("string");
      expect(l.href.length).toBeGreaterThan(0);
      expect(l.label.length).toBeGreaterThan(0);
    }
  });

  it("every feature tile has an Icon component + title + desc", () => {
    expect(VENUE_FEATURES.length).toBeGreaterThan(0);
    for (const t of VENUE_FEATURES) {
      expect(typeof t.Icon).toBe("object"); // lucide icons are forwardRef objects
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.desc.length).toBeGreaterThan(0);
    }
  });

  it("comparison rows are 3-tuples [need, agency, ekonobar]", () => {
    expect(COMPARISON_ROWS.length).toBeGreaterThan(0);
    for (const row of COMPARISON_ROWS) {
      expect(row).toHaveLength(3);
      row.forEach((cell) => expect(cell.length).toBeGreaterThan(0));
    }
  });

  it("hero stats each carry value + label", () => {
    for (const s of HERO_STATS) {
      expect(s.value.length).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(0);
    }
  });

  it("FAQ items each have a question + answer node", () => {
    expect(faqItems.length).toBeGreaterThan(0);
    for (const q of faqItems) {
      expect(q.question.length).toBeGreaterThan(0);
      expect(q.answer).toBeTruthy();
    }
  });
});
