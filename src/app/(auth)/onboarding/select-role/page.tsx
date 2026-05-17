"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter }  from "next/navigation";

const ROLES = [
  {
    value: "WAITER",
    label: "Konobar",
    desc: "Izgradite digitalni pasoš, prikupite verifikovane recenzije i pronađite posao.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="#f97316" strokeWidth="2" />
        <path d="M4 20C4 17.2386 7.58172 15 12 15C16.4183 15 20 17.2386 20 20" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    onboarding: "/onboarding/waiter",
  },
  {
    value: "VENUE_OWNER",
    label: "Vlasnik lokala",
    desc: "Objavite oglase, pronađite verifikovan kadar i upravljajte smenama.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M3 9L12 3L21 9V20C21 20.5523 20.5523 21 20 21H15V15H9V21H4C3.44772 21 3 20.5523 3 20V9Z" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ),
    onboarding: "/onboarding/venue",
  },
  {
    value: "HEADHUNTER",
    label: "Headhunter",
    desc: "Pretražite verifikovan talent, sačuvajte profile i kreirajte shortliste.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke="#f97316" strokeWidth="2" />
        <path d="M16.5 16.5L21 21" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    onboarding: "/onboarding/headhunter",
  },
];

export default function SelectRolePage() {
  const { update }   = useSession();
  const router       = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error,   setError]   = useState("");

  async function selectRole(role: string, onboarding: string) {
    setLoading(role);
    setError("");

    const res = await fetch("/api/auth/set-role", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ role }),
    });

    if (!res.ok) {
      setError("Greška. Pokušaj ponovo.");
      setLoading(null);
      return;
    }

    // Update JWT so role-guarded pages work immediately
    await update({ role });
    router.push(onboarding);
  }

  return (
    <div className="w-full max-w-lg">
      <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden fade-up">
        <div style={{ height: "3px", background: "linear-gradient(90deg, #f97316, #ea580c)" }} />

        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Dobrodošao na eKonobar</h1>
            <p className="text-neutral-400 text-sm font-light mt-1.5">
              Izaberi svoju ulogu da bismo prilagodili iskustvo.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {ROLES.map((r) => (
              <button
                key={r.value}
                onClick={() => selectRole(r.value, r.onboarding)}
                disabled={loading !== null}
                className="flex items-center gap-4 p-5 rounded-2xl border border-neutral-100 hover:border-orange-200 hover:bg-orange-50/50 transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed group"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0">
                  {loading === r.value ? (
                    <div className="w-5 h-5 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                  ) : r.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-neutral-800 mb-0.5">{r.label}</p>
                  <p className="text-xs text-neutral-400 font-light leading-relaxed">{r.desc}</p>
                </div>
                <svg
                  width="14" height="14" viewBox="0 0 16 16" fill="none"
                  className="text-neutral-300 group-hover:text-orange-400 transition-colors flex-shrink-0"
                >
                  <path d="M4 8H12M8 4L12 8L8 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
