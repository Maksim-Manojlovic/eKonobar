"use client";

import Link from "next/link";
import { Building2, ChefHat } from "lucide-react";
import { useLang } from "@/components/providers/LanguageProvider";
import { FlagSwitcher } from "@/components/ui/FlagSwitcher";

export default function PreloaderPage() {
  const { t } = useLang();

  return (
    <main
      className="relative min-h-screen flex flex-col items-center justify-center px-4"
      style={{
        backgroundColor: "#120a00",
        backgroundImage:
          "linear-gradient(rgba(249,115,22,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.06) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    >
      {/* Logo */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight">
          e<span className="text-orange-400">Konobar</span>
        </h1>
        <p className="mt-2 text-white/50 text-sm">
          {t("preloader", "tagline")}
        </p>
        <div className="mt-4 flex justify-center">
          <FlagSwitcher />
        </div>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
        <Link
          href="/for-venues"
          className="group relative flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-10 text-center transition-all duration-200 hover:border-orange-400/50 hover:bg-orange-400/10 hover:scale-[1.02]"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-400/15 text-orange-400 transition-colors group-hover:bg-orange-400/25">
            <Building2 size={32} />
          </div>
          <div>
            <p className="text-lg font-semibold text-white">
              {t("preloader", "ownerTitle")}
            </p>
            <p className="mt-1 text-sm text-white/50">
              {t("preloader", "ownerSubtitle")}
            </p>
          </div>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-orange-400/30 px-3 py-1 text-xs text-orange-400">
            {t("preloader", "ownerBadge")} →
          </span>
        </Link>

        <Link
          href="/for-waiters"
          className="group relative flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-10 text-center transition-all duration-200 hover:border-orange-400/50 hover:bg-orange-400/10 hover:scale-[1.02]"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-400/15 text-orange-400 transition-colors group-hover:bg-orange-400/25">
            <ChefHat size={32} />
          </div>
          <div>
            <p className="text-lg font-semibold text-white">
              {t("preloader", "waiterTitle")}
            </p>
            <p className="mt-1 text-sm text-white/50">
              {t("preloader", "waiterSubtitle")}
            </p>
          </div>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-orange-400/30 px-3 py-1 text-xs text-orange-400">
            {t("preloader", "waiterBadge")} →
          </span>
        </Link>
      </div>

      {/* Skip link */}
      <p className="mt-10 text-xs text-white/30">
        {t("preloader", "haveAccount")}{" "}
        <Link href="/login" className="text-orange-400/70 hover:text-orange-400 transition-colors">
          {t("preloader", "signIn")}
        </Link>
      </p>
    </main>
  );
}
