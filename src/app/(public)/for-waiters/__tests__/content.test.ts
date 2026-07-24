import { describe, it, expect } from "vitest";
import { NAV_LINKS, FOOTER_LINKS, HERO_STATS, WAITER_FEATURES, faqItems } from "../content";

describe("for-waiters content", () => {
  it("nav + footer links are non-empty and href/label-shaped", () => {
    expect(NAV_LINKS.length).toBeGreaterThan(0);
    expect(FOOTER_LINKS.length).toBeGreaterThan(0);
    for (const l of [...NAV_LINKS, ...FOOTER_LINKS]) {
      expect(l.href.length).toBeGreaterThan(0);
      expect(l.label.length).toBeGreaterThan(0);
    }
  });

  it("every feature tile has an Icon component + title + desc", () => {
    expect(WAITER_FEATURES.length).toBeGreaterThan(0);
    for (const t of WAITER_FEATURES) {
      expect(typeof t.Icon).toBe("object");
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.desc.length).toBeGreaterThan(0);
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
