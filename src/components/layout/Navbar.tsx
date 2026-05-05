"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

function dashboardUrl(role: string | undefined): string {
  if (role === "VENUE_OWNER") return "/venue";
  if (role === "ADMIN") return "/admin";
  if (role === "HEADHUNTER") return "/headhunter";
  return "/waiter";
}

const LogoMark = () => (
  <div
    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
    style={{ background: "#f97316", boxShadow: "0 2px 8px rgba(249,115,22,0.35)" }}
  >
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 3C7 3 4.5 5.5 4.5 8.5C4.5 12.5 10 18 10 18C10 18 15.5 12.5 15.5 8.5C15.5 5.5 13 3 10 3Z"
        fill="white"
        opacity="0.95"
      />
      <circle cx="10" cy="8.5" r="2.2" fill="white" />
    </svg>
  </div>
);

const NAV_LINKS = [
  { href: "/venues", label: "Lokali" },
  { href: "/jobs",   label: "Poslovi" },
];

export default function Navbar({ activePath }: { activePath?: string }) {
  const { data: session } = useSession();
  const role = session?.user?.role as string | undefined;

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-neutral-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-bold text-lg tracking-tight text-neutral-900">eKonobar</span>
        </Link>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activePath === href
                  ? "bg-orange-50 text-orange-600"
                  : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-2">
          {session ? (
            <Link
              href={dashboardUrl(role)}
              className="btn-primary text-white text-sm font-semibold px-4 py-2 rounded-2xl"
            >
              Dashboard →
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors px-3 py-2"
              >
                Prijava
              </Link>
              <Link
                href="/register"
                className="btn-primary text-white text-sm font-semibold px-4 py-2 rounded-2xl"
              >
                Registracija
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
