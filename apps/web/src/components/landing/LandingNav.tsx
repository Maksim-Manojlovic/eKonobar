"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/ui/LogoMark";
import { FlagSwitcher } from "@/components/ui/FlagSwitcher";
import { NavAuthButton } from "@/components/ui/NavAuthButton";

export interface NavLink {
  href: string;
  label: string;
}

interface Props {
  /** In-page / route links shown in the desktop bar + mobile drawer. */
  links: NavLink[];
  /** Right-hand primary CTA (e.g. "Zakaži demo" → #demo, "Registracija" → /register). */
  cta: { href: string; label: string };
  /** Optional uppercase pill next to the wordmark (e.g. "za vlasnike"). */
  badge?: string;
}

/**
 * Shared marketing-page top nav. Replaces the byte-for-byte-duplicated <nav> +
 * mobile-drawer that lived inline in both /for-venues and /for-waiters (CQ-U).
 * Page-specific menus stay page-specific via the `links`/`cta`/`badge` props —
 * only the shell (logo, drawer mechanics, FlagSwitcher/auth slot) is shared.
 */
export function LandingNav({ links, cta, badge }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between relative">
      <Link href="/" className="flex items-center gap-3">
        <LogoMark />
        <span className="font-bold text-xl tracking-tight text-gray-900">eKonobar</span>
        {badge && (
          <span className="hidden lg:inline-block whitespace-nowrap text-[10px] font-bold tracking-[0.18em] uppercase text-orange-500 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full ml-1">
            {badge}
          </span>
        )}
      </Link>

      <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
        {links.map(l => (
          <a key={l.href} href={l.href} className="hover:text-neutral-800 transition-colors">{l.label}</a>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <FlagSwitcher />
        <NavAuthButton />
        <Link href={cta.href} className="hidden sm:block btn-primary text-white text-sm font-semibold px-5 py-2.5 rounded-2xl">
          {cta.label}
        </Link>
        <button
          onClick={() => setMobileOpen(v => !v)}
          className="md:hidden flex flex-col gap-1.5 p-2 rounded-xl hover:bg-neutral-100 transition-colors"
          aria-label="Meni"
        >
          {mobileOpen ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 4L16 16M16 4L4 16" stroke="#374151" strokeWidth="2" strokeLinecap="round" /></svg>
          ) : (
            <>
              <span className="w-5 h-0.5 bg-neutral-700 rounded-full" />
              <span className="w-5 h-0.5 bg-neutral-700 rounded-full" />
              <span className="w-4 h-0.5 bg-neutral-700 rounded-full self-end" />
            </>
          )}
        </button>
      </div>

      {mobileOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 mx-4 bg-white rounded-2xl shadow-lg border border-neutral-100 overflow-hidden z-50">
          {links.map(l => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center px-5 py-3.5 text-sm font-medium text-neutral-700 hover:bg-orange-50 hover:text-orange-600 transition-colors border-b border-neutral-50 last:border-0"
            >
              {l.label}
            </a>
          ))}
          <div className="p-3">
            <Link
              href={cta.href}
              onClick={() => setMobileOpen(false)}
              className="btn-primary w-full text-white text-sm font-semibold py-3 rounded-xl text-center block"
            >
              {cta.label}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
