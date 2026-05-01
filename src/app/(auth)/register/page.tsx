"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Role = "WAITER" | "VENUE_OWNER";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  city: string;
  phone: string;
  experience: string;
  venueName: string;
  acceptTerms: boolean;
  acceptAlerts: boolean;
}

const CITIES = ["Novi Beograd", "Stari Grad", "Dorćol", "Vračar", "Savski Venac", "Savamala", "Zemun", "Zvezdara"];
const EXPERIENCE = [
  "Bez iskustva — ali spreman da učim",
  "Manje od 1 godine",
  "1–2 godine",
  "3–5 godina",
  "5+ godina",
];

const GoogleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const FacebookIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const SelectArrow = `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23a3a3a0' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

function passwordScore(val: string): number {
  let s = 0;
  if (val.length >= 8) s++;
  if (/[A-Z]/.test(val)) s++;
  if (/[0-9]/.test(val)) s++;
  if (/[^A-Za-z0-9]/.test(val)) s++;
  return s;
}

const STRENGTH_COLORS = ["", "#f97316", "#f97316", "#fb923c", "#22c55e"];
const STRENGTH_LABELS = ["", "Slaba", "Srednja", "Dobra", "Jaka"];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role>("WAITER");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    city: "",
    phone: "",
    experience: "",
    venueName: "",
    acceptTerms: false,
    acceptAlerts: false,
  });

  function f(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
  }

  const score = passwordScore(form.password);
  const progress = step === 1 ? 33 : step === 2 ? 66 : 100;
  const stepTitles = ["Kreiraj nalog", "Tvoji podaci", "Gotovo!"];

  function goStep(next: number) {
    setError("");
    setStep(next);
  }

  function validateStep1() {
    if (!form.firstName || !form.lastName || !form.email) {
      setError("Popuni sva obavezna polja.");
      return false;
    }
    return true;
  }

  function validateStep2() {
    if (!form.password) { setError("Unesite lozinku."); return false; }
    if (form.password.length < 8) { setError("Lozinka mora imati najmanje 8 karaktera."); return false; }
    if (form.password !== form.confirmPassword) { setError("Lozinke se ne podudaraju."); return false; }
    if (!form.city) { setError("Izaberi grad/opštinu."); return false; }
    return true;
  }

  async function handleSubmit() {
    if (!form.acceptTerms) { setError("Morate prihvatiti uslove korišćenja."); return; }
    if (role === "WAITER" && !form.experience) { setError("Izaberi nivo iskustva."); return; }
    if (role === "VENUE_OWNER" && !form.venueName) { setError("Unesite naziv lokala."); return; }

    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        password: form.password,
        role,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Greška pri registraciji.");
      setLoading(false);
      return;
    }

    await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    router.push(role === "WAITER" ? "/onboarding/waiter" : "/onboarding/venue");
  }

  return (
    <div className="w-full max-w-md">

      <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden fade-up">
        <div style={{ height: "3px", background: "linear-gradient(90deg, #f97316, #ea580c)" }} />

        <div className="p-8">
          {/* Step header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">{stepTitles[step - 1]}</h1>
              <p className="text-neutral-400 text-sm font-light mt-0.5">
                Korak <span className="font-semibold text-neutral-600">{step}</span> od 3
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`step-dot ${i === step ? "active" : i < step ? "done" : ""}`}
                />
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-[3px] bg-neutral-100 rounded-full overflow-hidden mb-8">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg, #f97316, #ea580c)" }}
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
              {error}
            </div>
          )}

          {/* ── STEP 1 ─────────────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="slide-in">
              <p className="text-sm font-semibold text-neutral-700 mb-4">Ko si ti?</p>
              <div className="flex gap-3 mb-6">
                <div
                  className={`role-card ${role === "WAITER" ? "selected" : ""}`}
                  onClick={() => setRole("WAITER")}
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center mb-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="4" stroke="#f97316" strokeWidth="2" fill="none" />
                      <path d="M4 20C4 17.24 7.58 15 12 15C16.42 15 20 17.24 20 20" stroke="#f97316" strokeWidth="2" strokeLinecap="round" fill="none" />
                    </svg>
                  </div>
                  <div className="font-bold text-sm text-neutral-800">Konobar</div>
                  <div className="text-xs text-neutral-400 font-light mt-0.5">Tražim angažmane</div>
                </div>
                <div
                  className={`role-card ${role === "VENUE_OWNER" ? "selected" : ""}`}
                  onClick={() => setRole("VENUE_OWNER")}
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center mb-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="6" width="18" height="14" rx="3" stroke="#f97316" strokeWidth="2" fill="none" />
                      <path d="M3 10H21M9 6V4C9 3.45 9.45 3 10 3H14C14.55 3 15 3.45 15 4V6" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="font-bold text-sm text-neutral-800">Vlasnik lokala</div>
                  <div className="text-xs text-neutral-400 font-light mt-0.5">Postavljam oglase</div>
                </div>
              </div>

              {/* Social */}
              <div className="flex gap-3 mb-5">
                <button className="social-btn flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-neutral-600">
                  <GoogleIcon />
                  Google
                </button>
                <button className="social-btn flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-neutral-600">
                  <FacebookIcon />
                  Facebook
                </button>
              </div>

              <div className="flex items-center gap-3 mb-5">
                <div className="divider-line" />
                <span className="text-xs text-neutral-400 font-medium flex-shrink-0">ili sa email adresom</span>
                <div className="divider-line" />
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Ime</label>
                    <input type="text" className="auth-input" placeholder="Marko" value={form.firstName} onChange={f("firstName")} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Prezime</label>
                    <input type="text" className="auth-input" placeholder="Milošević" value={form.lastName} onChange={f("lastName")} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Email adresa</label>
                  <input type="email" className="auth-input" placeholder="ime@primer.rs" value={form.email} onChange={f("email")} />
                </div>
              </div>

              <button
                onClick={() => { if (validateStep1()) goStep(2); }}
                className="btn-primary w-full text-white font-bold py-3.5 rounded-2xl text-sm mt-5"
              >
                Nastavi →
              </button>
            </div>
          )}

          {/* ── STEP 2 ─────────────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="slide-in flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Lozinka</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="auth-input pr-12"
                    placeholder="Min. 8 karaktera"
                    value={form.password}
                    onChange={f("password")}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" fill="none" />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                  </button>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="strength-bar"
                      style={{ background: i <= score ? STRENGTH_COLORS[score] : "#f0f0ee" }}
                    />
                  ))}
                </div>
                <div className="text-[10px] text-neutral-400 mt-1">
                  {score > 0 ? `Jačina: ${STRENGTH_LABELS[score]}` : "Unesite lozinku"}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Potvrdi lozinku</label>
                <input
                  type="password"
                  className="auth-input"
                  placeholder="Ponovi lozinku"
                  value={form.confirmPassword}
                  onChange={f("confirmPassword")}
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Grad / Opština</label>
                <select
                  className="auth-input"
                  value={form.city}
                  onChange={f("city")}
                  style={{
                    appearance: "none",
                    backgroundImage: SelectArrow,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 14px center",
                  }}
                >
                  <option value="" disabled>Izaberi opštinu</option>
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                  Broj telefona <span className="text-neutral-400 font-light">(opciono)</span>
                </label>
                <input type="tel" className="auth-input" placeholder="+381 60 000 0000" value={form.phone} onChange={f("phone")} />
              </div>

              <div className="flex gap-3 mt-1">
                <button
                  onClick={() => goStep(1)}
                  className="flex-1 border-2 border-neutral-200 text-neutral-600 font-semibold py-3.5 rounded-2xl text-sm hover:border-orange-300 hover:text-orange-500 transition-colors"
                >
                  ← Nazad
                </button>
                <button
                  onClick={() => { if (validateStep2()) goStep(3); }}
                  className="btn-primary flex-1 text-white font-bold py-3.5 rounded-2xl text-sm"
                >
                  Nastavi →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3 ─────────────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="slide-in flex flex-col gap-4">
              {role === "WAITER" ? (
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Godine iskustva</label>
                  <select
                    className="auth-input"
                    value={form.experience}
                    onChange={f("experience")}
                    style={{
                      appearance: "none",
                      backgroundImage: SelectArrow,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 14px center",
                    }}
                  >
                    <option value="" disabled>Izaberi iskustvo</option>
                    {EXPERIENCE.map((e) => <option key={e}>{e}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Naziv lokala</label>
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="npr. Kafana Kod Mene"
                    value={form.venueName}
                    onChange={f("venueName")}
                  />
                </div>
              )}

              {/* Terms */}
              <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-4 flex flex-col gap-2.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.acceptTerms}
                    onChange={f("acceptTerms")}
                    className="mt-0.5 accent-orange-500 flex-shrink-0"
                  />
                  <span className="text-xs text-neutral-500 font-light leading-relaxed">
                    Slažem se sa{" "}
                    <Link href="/terms" className="text-orange-500 font-medium">Uslovima korišćenja</Link>
                    {" "}i{" "}
                    <Link href="/privacy" className="text-orange-500 font-medium">Politikom privatnosti</Link>
                    {" "}platforme eKonobar.
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.acceptAlerts}
                    onChange={f("acceptAlerts")}
                    className="mt-0.5 accent-orange-500 flex-shrink-0"
                  />
                  <span className="text-xs text-neutral-500 font-light leading-relaxed">
                    Prihvatam obaveštenja o Red Alert™ oglasima i novim prilikama.
                  </span>
                </label>
              </div>

              {/* Summary */}
              <div className="rounded-2xl p-4" style={{ background: "#fff7ed", border: "1px solid rgba(249,115,22,0.2)" }}>
                <div className="text-xs font-bold text-orange-600 mb-2.5">Šta dobijaš odmah:</div>
                <div className="flex flex-col gap-1.5">
                  {[
                    "Waiter Passport™ profil — besplatno",
                    "Pristup svim Red Alert™ oglasima",
                    "Geofencing verifikacija smena",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-xs text-neutral-600">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M1.5 6.5L4.5 9.5L10.5 3.5" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => goStep(2)}
                  className="flex-shrink-0 border-2 border-neutral-200 text-neutral-600 font-semibold px-5 py-3.5 rounded-2xl text-sm hover:border-orange-300 hover:text-orange-500 transition-colors"
                >
                  ←
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="btn-primary flex-1 text-white font-bold py-3.5 rounded-2xl text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? "Kreiranje naloga..." : "Kreiraj nalog →"}
                </button>
              </div>
            </div>
          )}

          <p className="text-center text-sm text-neutral-400 font-light mt-6">
            Već imaš nalog?{" "}
            <Link href="/login" className="text-orange-500 font-semibold hover:text-orange-600 transition-colors">
              Prijavi se →
            </Link>
          </p>
        </div>
      </div>

      {/* Trust strip */}
      <div className="flex items-center justify-center gap-4 mt-6 fade-up">
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="4.5" width="10" height="7" rx="2" stroke="#d1d5db" strokeWidth="1.3" fill="none" />
            <path d="M3.5 4.5V3.5C3.5 2.12 4.62 1 6 1C7.38 1 8.5 2.12 8.5 3.5V4.5" stroke="#d1d5db" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          SSL zaštita
        </div>
        <div className="w-1 h-1 rounded-full bg-neutral-300" />
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M6 1L7.297 3.91H11.412L8.057 6.305L9.354 10.215L6 7.82L2.646 10.215L3.943 6.305L0.588 3.91H4.703L6 1Z" fill="#d1d5db" />
          </svg>
          GDPR usklađeno
        </div>
        <div className="w-1 h-1 rounded-full bg-neutral-300" />
        <span className="text-xs text-neutral-400">Uvek besplatno za konobara</span>
      </div>

    </div>
  );
}
