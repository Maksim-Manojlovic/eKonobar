"use client";

import { useState } from "react";

const LogoMark = () => (
  <div
    className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0"
    style={{ boxShadow: "0 2px 8px rgba(249,115,22,0.3)" }}
  >
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
      <path d="M10 3C7 3 4.5 5.5 4.5 8.5C4.5 12.5 10 18 10 18C10 18 15.5 12.5 15.5 8.5C15.5 5.5 13 3 10 3Z" fill="white" opacity="0.95" />
      <circle cx="10" cy="8.5" r="2.2" fill="white" />
    </svg>
  </div>
);

const PinIcon = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
    <path d="M7 1C4.24 1 2 3.24 2 6C2 9.5 7 14 7 14C7 14 12 9.5 12 6C12 3.24 9.76 1 7 1ZM7 7.5C6.17 7.5 5.5 6.83 5.5 6C5.5 5.17 6.17 4.5 7 4.5C7.83 4.5 8.5 5.17 8.5 6C8.5 6.83 7.83 7.5 7 7.5Z" fill="#d1d5db" />
  </svg>
);

const jobLinks = [
  "Posao — Novi Beograd",
  "Posao — Stari Grad / Dorćol",
  "Posao — Vračar",
  "Posao — Savski Venac",
  "Posao — Savamala",
];

const userLinks = [
  "Pravila za Waiter Passport™",
  "Kako funkcioniše Red Alert™",
  "Sistem Geofencing recenzija",
  "Cenovnik za vlasnike lokala",
  "Uslovi korišćenja",
  "Politika privatnosti",
];

const supportLinks = [
  "Centar za pomoć",
  "Zakaži demo za lokal",
  "Prijavi problem",
];

export function Footer() {
  const [lang, setLang] = useState<"rs" | "en">("rs");
  const [email, setEmail] = useState("");

  return (
    <footer style={{ background: "#F9FAFB" }}>
      {/* Top gradient border */}
      <div style={{ height: "2px", background: "linear-gradient(90deg, transparent 0%, #f97316 30%, #ea580c 60%, transparent 100%)" }} />

      <div className="max-w-7xl mx-auto px-6 pt-14 pb-8">

        {/* Four-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

          {/* Col 1: Brand */}
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2.5">
              <LogoMark />
              <span className="font-extrabold text-xl tracking-tight text-neutral-900">eKonobar</span>
            </div>

            <p className="text-sm text-neutral-500 font-light leading-relaxed">
              Vodeća platforma za verifikaciju i zapošljavanje u ugostiteljstvu Beograda.
            </p>

            {/* Trust badges */}
            <div className="flex flex-col gap-2">
              <div className="inline-flex items-center gap-2 bg-white border border-neutral-200 rounded-xl px-3 py-2 self-start">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1L8.297 4.91H12.412L9.057 7.305L10.354 11.215L7 8.82L3.646 11.215L4.943 7.305L1.588 4.91H5.703L7 1Z" fill="#f97316" />
                </svg>
                <span className="text-[11px] font-semibold text-neutral-600">Powered by CodeIT</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-white border border-neutral-200 rounded-xl px-3 py-2 self-start">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1.5C4.515 1.5 2.5 3.515 2.5 6C2.5 8.485 4.515 10.5 7 10.5C9.485 10.5 11.5 8.485 11.5 6C11.5 3.515 9.485 1.5 7 1.5ZM5.5 9L3 6.5L3.71 5.79L5.5 7.58L10.29 2.79L11 3.5L5.5 9Z" fill="#22c55e" />
                </svg>
                <span className="text-[11px] font-semibold text-neutral-600">Verified by 500+ Venues</span>
              </div>
            </div>

            {/* Social icons */}
            <div className="flex items-center gap-2.5 mt-1">
              {[
                <svg key="ig" width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" stroke="#9ca3af" strokeWidth="2" fill="none" /><circle cx="12" cy="12" r="4" stroke="#9ca3af" strokeWidth="2" fill="none" /><circle cx="17.5" cy="6.5" r="1" fill="#9ca3af" /></svg>,
                <svg key="tt" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.77a4.85 4.85 0 01-1.01-.08z" fill="#9ca3af" /></svg>,
                <svg key="em" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" fill="#9ca3af" /></svg>,
              ].map((icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-8 h-8 rounded-xl bg-white border border-neutral-200 flex items-center justify-center hover:border-orange-300 hover:bg-orange-50 transition-colors"
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Col 2: Istraži poslove */}
          <div>
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-5">Istraži poslove</div>
            <ul className="flex flex-col gap-3">
              {jobLinks.map((label) => (
                <li key={label}>
                  <a href="/jobs" className="flex items-center gap-2 text-sm text-neutral-600 hover:text-orange-500 transition-colors font-medium group">
                    <PinIcon />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Za korisnike */}
          <div>
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-5">Za korisnike</div>
            <ul className="flex flex-col gap-3">
              {userLinks.map((label) => (
                <li key={label}>
                  <a href="#" className="text-sm text-neutral-600 hover:text-orange-500 transition-colors font-medium">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Podrška + newsletter */}
          <div>
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-5">Podrška</div>
            <ul className="flex flex-col gap-3 mb-6">
              <li>
                <a href="mailto:hello@ekonobar.rs" className="flex items-center gap-2 text-sm text-neutral-600 hover:text-orange-500 transition-colors font-medium">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <rect x="1.5" y="3" width="11" height="8" rx="2" stroke="#d1d5db" strokeWidth="1.4" fill="none" />
                    <path d="M1.5 5L7 8.5L12.5 5" stroke="#d1d5db" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  hello@ekonobar.rs
                </a>
              </li>
              {supportLinks.map((label) => (
                <li key={label}>
                  <a href="#" className="text-sm text-neutral-600 hover:text-orange-500 transition-colors font-medium">
                    {label}
                  </a>
                </li>
              ))}
            </ul>

            {/* Newsletter */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-4">
              <div className="text-xs font-bold text-neutral-700 mb-1">Budi prvi u gradu</div>
              <p className="text-[11px] text-neutral-400 font-light mb-3">Novi oglasi i Red Alert™ u tvojoj opštini.</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="tvoj@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 text-xs px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 outline-none focus:border-orange-300 transition-colors font-medium min-w-0"
                />
                <button
                  className="bg-orange-500 hover:bg-orange-600 transition-colors text-white text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0"
                  onClick={() => setEmail("")}
                >
                  →
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Divider */}
        <div className="h-px bg-neutral-200 mb-6" />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

          <div className="text-xs text-neutral-400 font-medium">
            © 2026 eKonobar. Sva prava zadržana.
          </div>

          {/* System status */}
          <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-full px-3.5 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-blink" style={{ boxShadow: "0 0 0 3px rgba(34,197,94,0.2)" }} />
            <span className="text-[11px] font-semibold text-neutral-500">
              System Status: <span className="text-green-600">Online</span>
            </span>
          </div>

          {/* Language switcher */}
          <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-xl overflow-hidden text-xs font-bold">
            <button
              onClick={() => setLang("rs")}
              className={`px-3.5 py-1.5 transition-colors ${lang === "rs" ? "bg-orange-500 text-white" : "text-neutral-500 hover:text-neutral-800"}`}
            >
              RS
            </button>
            <button
              onClick={() => setLang("en")}
              className={`px-3.5 py-1.5 transition-colors ${lang === "en" ? "bg-orange-500 text-white" : "text-neutral-500 hover:text-neutral-800"}`}
            >
              EN
            </button>
          </div>

        </div>
      </div>
    </footer>
  );
}
