import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";

function dashboardUrl(role: string | undefined): string {
  if (role === "VENUE_OWNER")  return "/venue";
  if (role === "ADMIN")        return "/admin";
  if (role === "HEADHUNTER")   return "/headhunter";
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

export async function Navbar() {
  const session = await getServerSession(authOptions);
  const href = session ? dashboardUrl(session.user?.role) : null;

  return (
    <nav className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3">
        <LogoMark />
        <span className="font-bold text-xl tracking-tight text-neutral-900">eKonobar</span>
      </Link>

      <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
        <Link href="#how" className="hover:text-neutral-800 transition-colors">Kako funkcioniše</Link>
        <Link href="#venues" className="hover:text-neutral-800 transition-colors">Za lokale</Link>
        <Link href="#passport" className="hover:text-neutral-800 transition-colors">Passport™</Link>
      </div>

      <div className="flex items-center gap-3">
        {href ? (
          <Link
            href={href}
            className="btn-primary text-white text-sm font-semibold px-5 py-2.5 rounded-2xl"
          >
            Dashboard →
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors px-4 py-2"
            >
              Prijava
            </Link>
            <Link
              href="/register"
              className="btn-primary text-white text-sm font-semibold px-5 py-2.5 rounded-2xl"
            >
              Registracija
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
