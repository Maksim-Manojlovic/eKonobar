"use client";

import React, { useState, useRef, useEffect } from "react";
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

type Variant = "light" | "dark";

/**
 * Language switcher. Shows the active language's flag (Serbian by default) as a
 * trigger; clicking opens a dropdown with the other languages. `variant="dark"`
 * styles the panel for the dark dashboard top bar; default `"light"` for public
 * / auth surfaces.
 */
export function FlagSwitcher({
  className,
  variant = "light",
}: {
  className?: string;
  variant?: Variant;
}) {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const { component: Current, name: currentName } = FLAG_COMPONENTS[lang];
  const others = LANGS.filter((code) => code !== lang);

  const panelCls =
    variant === "dark"
      ? "border-white/10 bg-[#1a0e02]"
      : "border-neutral-200 bg-white";
  const rowCls =
    variant === "dark"
      ? "text-orange-100/80 hover:bg-orange-500/10 hover:text-orange-300"
      : "text-neutral-700 hover:bg-neutral-100";
  const chevronCls = variant === "dark" ? "text-orange-200/60" : "text-neutral-400";

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={currentName}
        aria-label={`Jezik: ${currentName}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-md p-0.5 cursor-pointer transition-transform hover:scale-105 focus:outline-none"
      >
        <span className="block w-7 h-5 overflow-hidden rounded-sm ring-1 ring-black/10">
          <Current />
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          className={`transition-transform ${open ? "rotate-180" : ""} ${chevronCls}`}
        >
          <path
            d="M2 4l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute right-0 top-full mt-2 w-36 rounded-xl border ${panelCls} shadow-xl z-50 overflow-hidden`}
        >
          {others.map((code) => {
            const { component: Flag, name } = FLAG_COMPONENTS[code];
            return (
              <button
                key={code}
                role="option"
                aria-selected={false}
                onClick={() => {
                  setLang(code);
                  setOpen(false);
                }}
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors cursor-pointer ${rowCls}`}
              >
                <span className="block w-6 h-4 overflow-hidden rounded-sm ring-1 ring-black/10 flex-shrink-0">
                  <Flag />
                </span>
                {name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
