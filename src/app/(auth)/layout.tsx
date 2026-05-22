import Link from "next/link";
import { FlagSwitcher } from "@/components/ui/FlagSwitcher";

const LogoMark = () => (
  <div
    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
    style={{ background: "#f97316", boxShadow: "0 2px 8px rgba(249,115,22,0.3)" }}
  >
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
      <path d="M10 3C7 3 4.5 5.5 4.5 8.5C4.5 12.5 10 18 10 18C10 18 15.5 12.5 15.5 8.5C15.5 5.5 13 3 10 3Z" fill="white" opacity="0.95" />
      <circle cx="10" cy="8.5" r="2.2" fill="white" />
    </svg>
  </div>
);

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
