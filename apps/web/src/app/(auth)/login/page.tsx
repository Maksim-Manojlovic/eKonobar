"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLang } from "@/components/providers/LanguageProvider";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const FacebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      rememberMe: String(rememberMe),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(
        result.error.includes("Previše")
          ? result.error
          : t("login", "errorDefault"),
      );
      return;
    }

    const session = await getSession();
    const role = session?.user?.role;

    if (role === "ADMIN") router.push("/admin");
    else if (role === "VENUE_OWNER") router.push("/venue");
    else if (role === "HEADHUNTER") router.push("/headhunter");
    else router.push("/waiter");

    router.refresh();
  }

  return (
    <div className="w-full max-w-md">

      {/* Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden fade-up">
        <div style={{ height: "3px", background: "linear-gradient(90deg, #f97316, #ea580c)" }} />

        <div className="p-8">
          <div className="mb-8 fade-up-2">
            <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">{t("login", "title")}</h1>
            <p className="text-neutral-400 text-sm font-light mt-1.5">{t("login", "subtitle")}</p>
          </div>

          {/* Social buttons */}
          <div className="flex gap-3 mb-6 fade-up-2">
            <button
              onClick={() => signIn("google")}
              className="social-btn flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-neutral-600"
            >
              <GoogleIcon />
              Google
            </button>
            <button
              onClick={() => signIn("facebook")}
              className="social-btn flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-neutral-600"
            >
              <FacebookIcon />
              Facebook
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6 fade-up-2">
            <div className="divider-line" />
            <span className="text-xs text-neutral-400 font-medium flex-shrink-0">{t("login", "orWithEmail")}</span>
            <div className="divider-line" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 fade-up-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5">{t("login", "emailLabel")}</label>
              <input
                type="email"
                className="auth-input"
                placeholder={t("login", "emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-neutral-600">{t("login", "passwordLabel")}</label>
                <Link
                  href="/reset-password"
                  className="text-xs text-orange-500 font-medium hover:text-orange-600 transition-colors"
                >
                  {t("login", "forgotPassword")}
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="auth-input pr-12"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" fill="none" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded accent-orange-500"
              />
              <label htmlFor="remember" className="text-sm text-neutral-500 font-light cursor-pointer">
                {t("login", "rememberMe")}
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-white font-bold py-3.5 rounded-2xl text-sm mt-1 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? t("login", "submitLoading") : t("login", "submit")}
            </button>
          </form>

          <p className="text-center text-sm text-neutral-400 font-light mt-6">
            {t("login", "noAccount")}{" "}
            <Link href="/register" className="text-orange-500 font-semibold hover:text-orange-600 transition-colors">
              {t("login", "registerLink")}
            </Link>
          </p>
        </div>
      </div>

      {/* Trust strip */}
      <div className="flex items-center justify-center gap-4 mt-6 fade-up-3">
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="4.5" width="10" height="7" rx="2" stroke="#d1d5db" strokeWidth="1.3" fill="none" />
            <path d="M3.5 4.5V3.5C3.5 2.12 4.62 1 6 1C7.38 1 8.5 2.12 8.5 3.5V4.5" stroke="#d1d5db" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          {t("login", "ssl")}
        </div>
        <div className="w-1 h-1 rounded-full bg-neutral-300" />
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M6 1L7.297 3.91H11.412L8.057 6.305L9.354 10.215L6 7.82L2.646 10.215L3.943 6.305L0.588 3.91H4.703L6 1Z" fill="#d1d5db" />
          </svg>
          {t("login", "gdpr")}
        </div>
        <div className="w-1 h-1 rounded-full bg-neutral-300" />
        <span className="text-xs text-neutral-400">{t("login", "venues")}</span>
      </div>

    </div>
  );
}
