"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Lang, TranslationNamespace, translations } from "@/lib/i18n";

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: <N extends TranslationNamespace>(namespace: N, key: keyof typeof translations.sr[N]) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("sr");

  useEffect(() => {
    const stored = localStorage.getItem("ek_lang") as Lang | null;
    if (stored && ["sr", "en", "ru"].includes(stored)) {
      setLangState(stored);
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("ek_lang", l);
  };

  const t = <N extends TranslationNamespace>(
    namespace: N,
    key: keyof typeof translations.sr[N],
  ): string => {
    const ns = translations[lang][namespace] as Record<string, string>;
    return ns[key as string] ?? String(key);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}
