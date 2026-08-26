import Link from "next/link";
import { LogoMark } from "@/components/ui/LogoMark";

interface Props {
  /** Footer link row; varies per page. */
  links: { href: string; label: string }[];
}

/**
 * Minimal marketing-page footer (logo + copyright + link row). Replaces the
 * inline <footer> duplicated across /for-venues and /for-waiters (CQ-U). Distinct
 * from the richer multi-column `components/landing/Footer` used by /landing.
 */
export function LandingFooter({ links }: Props) {
  return (
    <footer className="border-t border-neutral-100 bg-white">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LogoMark className="w-8 h-8" svg={16} />
          <span className="text-sm font-bold text-neutral-700">eKonobar</span>
          <span className="text-xs text-neutral-400">© 2026 — Beograd</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-neutral-500 font-medium">
          {links.map(l => (
            <Link key={`${l.href}-${l.label}`} href={l.href} className="hover:text-orange-500 transition-colors">{l.label}</Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
