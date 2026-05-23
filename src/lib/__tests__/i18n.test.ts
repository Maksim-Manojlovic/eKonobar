import { describe, it, expect } from "vitest";
import { translations, FLAGS } from "../i18n";
import type { Lang, TranslationNamespace } from "../i18n";

// Pure translation-map tests — no rendering needed.

const LANGS: Lang[] = ["sr", "en", "ru"];
const NAMESPACES = Object.keys(translations.sr) as TranslationNamespace[];

describe("translations", () => {
  it("all 3 languages exist", () => {
    for (const lang of LANGS) {
      expect(translations).toHaveProperty(lang);
    }
  });

  it("each language has the same namespaces as Serbian", () => {
    for (const lang of LANGS) {
      const langKeys = Object.keys(translations[lang]).sort();
      const srKeys   = Object.keys(translations.sr).sort();
      expect(langKeys).toEqual(srKeys);
    }
  });

  it("each namespace has the same keys across all languages", () => {
    for (const ns of NAMESPACES) {
      const srKeys = Object.keys(translations.sr[ns]).sort();
      for (const lang of LANGS) {
        const langKeys = Object.keys(translations[lang][ns] as object).sort();
        expect(langKeys).toEqual(srKeys);
      }
    }
  });

  it("no translation value is empty string", () => {
    for (const lang of LANGS) {
      for (const ns of NAMESPACES) {
        const nsObj = translations[lang][ns] as Record<string, string>;
        for (const [key, val] of Object.entries(nsObj)) {
          expect(val, `${lang}.${ns}.${key} must not be empty`).not.toBe("");
        }
      }
    }
  });

  it("preloader.tagline differs between sr and en", () => {
    expect(translations.sr.preloader.tagline).not.toBe(translations.en.preloader.tagline);
  });

  it("preloader.tagline differs between sr and ru", () => {
    expect(translations.sr.preloader.tagline).not.toBe(translations.ru.preloader.tagline);
  });
});

describe("FLAGS", () => {
  it("has exactly 3 entries", () => {
    expect(FLAGS).toHaveLength(3);
  });

  it("contains sr, en, ru codes", () => {
    const codes = FLAGS.map(f => f.code);
    expect(codes).toContain("sr");
    expect(codes).toContain("en");
    expect(codes).toContain("ru");
  });

  it("each flag has non-empty name", () => {
    for (const f of FLAGS) {
      expect(f.name.length).toBeGreaterThan(0);
    }
  });
});
