"use client";

import React from "react";
import { useLang } from "@/components/providers/LanguageProvider";
import { Lang } from "@/lib/i18n";

const SerbiaFlag = () => (
  <svg viewBox="0 0 3 2" className="w-full h-full">
    <rect width="3" height="0.667" y="0"     fill="#C8102E" />
    <rect width="3" height="0.667" y="0.667" fill="#003DA5" />
    <rect width="3" height="0.667" y="1.333" fill="#FFFFFF" />
  </svg>
);

const UKFlag = () => (
  <svg viewBox="0 0 60 30" className="w-full h-full">
    <rect width="60" height="30" fill="#012169" />
    {/* White diagonals */}
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
    {/* Red diagonal segments (offset for correct Union Jack) */}
    <path d="M0,0 L20,10 M40,20 L60,30" stroke="#C8102E" strokeWidth="4" />
    <path d="M60,0 L40,10 M20,20 L0,30" stroke="#C8102E" strokeWidth="4" />
    {/* White cross */}
    <path d="M30,0 V30 M0,15 H60" stroke="#fff" strokeWidth="10" />
    {/* Red cross */}
    <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
  </svg>
);

const RussiaFlag = () => (
  <svg viewBox="0 0 3 2" className="w-full h-full">
    <rect width="3" height="0.667" y="0"     fill="#FFFFFF" />
    <rect width="3" height="0.667" y="0.667" fill="#003DA5" />
    <rect width="3" height="0.667" y="1.333" fill="#D52B1E" />
  </svg>
);

const FLAG_COMPONENTS: Record<Lang, { component: () => React.ReactElement; name: string }> = {
  sr: { component: SerbiaFlag, name: "Srpski" },
  en: { component: UKFlag,     name: "English" },
  ru: { component: RussiaFlag, name: "Русский" },
};

const LANGS: Lang[] = ["sr", "en", "ru"];

export function FlagSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useLang();

  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      {LANGS.map((code) => {
        const { component: Flag, name } = FLAG_COMPONENTS[code];
        const active = lang === code;
        return (
          <button
            key={code}
            onClick={() => setLang(code)}
            title={name}
            aria-label={name}
            className={[
              "overflow-hidden rounded-md transition-all duration-150 cursor-pointer",
              active
                ? "ring-2 ring-orange-400 scale-110 opacity-100"
                : "opacity-40 hover:opacity-75 hover:scale-105",
            ].join(" ")}
            style={{ width: 48, height: 32 }}
          >
            <Flag />
          </button>
        );
      })}
    </div>
  );
}
