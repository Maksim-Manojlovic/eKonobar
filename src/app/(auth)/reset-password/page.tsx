"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ResetPasswordContent() {
  const params   = useSearchParams();
  const router   = useRouter();
  const token    = params.get("token") ?? "";

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState("");

  // Redirect to login after password reset
  useEffect(() => {
    if (success && token) {
      const t = setTimeout(() => router.push("/login"), 2500);
      return () => clearTimeout(t);
    }
  }, [success, token, router]);

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/forgot-password", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email }),
    });
    setLoading(false);
    if (res.ok) {
      setSuccess(true);
    } else {
      setError("Greška. Pokušaj ponovo.");
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Lozinke se ne poklapaju.");
      return;
    }
    if (password.length < 8) {
      setError("Lozinka mora imati najmanje 8 karaktera.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (res.ok) {
      setSuccess(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Greška. Pokušaj ponovo.");
    }
  }

  // ── Step 2: set new password ─────────────────────────────────────────────────
  if (token) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden fade-up">
          <div style={{ height: "3px", background: "linear-gradient(90deg, #f97316, #ea580c)" }} />
          <div className="p-8">
            {success ? (
              <div className="text-center py-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "1px solid #bbf7d0" }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17L4 12" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2 className="text-xl font-extrabold text-neutral-900 mb-2">Lozinka promenjena</h2>
                <p className="text-sm text-neutral-400">Bićeš preusmerjen na prijavu za trenutak...</p>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Nova lozinka</h1>
                  <p className="text-neutral-400 text-sm font-light mt-1.5">Unesi novu lozinku za svoj nalog.</p>
                </div>

                <form onSubmit={handleSetPassword} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Nova lozinka</label>
                    <div className="relative">
                      <input
                        type={showPw ? "text" : "password"}
                        className="auth-input pr-12"
                        placeholder="min. 8 karaktera"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" fill="none" />
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Potvrdi lozinku</label>
                    <input
                      type={showPw ? "text" : "password"}
                      className="auth-input"
                      placeholder="••••••••"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  {/* Strength hint */}
                  {password.length > 0 && (
                    <div className="flex gap-1">
                      {[...Array(4)].map((_, i) => {
                        const strength =
                          (password.length >= 8 ? 1 : 0) +
                          (/[A-Z]/.test(password) ? 1 : 0) +
                          (/[0-9]/.test(password) ? 1 : 0) +
                          (/[^a-zA-Z0-9]/.test(password) ? 1 : 0);
                        const colors = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-400"];
                        return (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i < strength ? colors[strength - 1] : "bg-neutral-200"
                            }`}
                          />
                        );
                      })}
                    </div>
                  )}

                  {error && (
                    <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full text-white font-bold py-3.5 rounded-2xl text-sm mt-1 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? "Čuvanje..." : "Sačuvaj novu lozinku"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: request reset email ──────────────────────────────────────────────
  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden fade-up">
        <div style={{ height: "3px", background: "linear-gradient(90deg, #f97316, #ea580c)" }} />
        <div className="p-8">
          {success ? (
            <div className="text-center py-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "linear-gradient(135deg, #fff7ed, #ffedd5)", border: "1px solid #fed7aa" }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19Z" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-neutral-900 mb-2">Proveri inbox</h2>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Ako postoji nalog vezan za <strong className="text-neutral-600">{email}</strong>,
                poslaćemo uputstvo za reset lozinke.
              </p>
              <p className="text-xs text-neutral-300 mt-3">Proveri i spam folder ako email ne stigne za par minuta.</p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Resetuj lozinku</h1>
                <p className="text-neutral-400 text-sm font-light mt-1.5">
                  Unesi email adresu i poslaćemo ti link za reset.
                </p>
              </div>

              <form onSubmit={handleRequestReset} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Email adresa</label>
                  <input
                    type="email"
                    className="auth-input"
                    placeholder="ime@primer.rs"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full text-white font-bold py-3.5 rounded-2xl text-sm mt-1 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? "Slanje..." : "Pošalji link za reset"}
                </button>
              </form>
            </>
          )}

          <p className="text-center text-sm text-neutral-400 font-light mt-6">
            <Link href="/login" className="text-orange-500 font-semibold hover:text-orange-600 transition-colors">
              ← Nazad na prijavu
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
