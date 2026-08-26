import Link from "next/link";
import { FlagSwitcher } from "@/components/ui/FlagSwitcher";
import { LogoMark } from "@/components/ui/LogoMark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-bg min-h-screen flex flex-col">
      <nav className="max-w-7xl mx-auto w-full px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-extrabold text-xl tracking-tight text-neutral-900">eKonobar</span>
        </Link>
        <div className="flex items-center gap-4">
          <FlagSwitcher />
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">Nazad na početnu</span>
          </Link>
        </div>
      </nav>

      <div className="flex-1 flex items-start justify-center px-4 py-8">
        {children}
      </div>
    </div>
  );
}
