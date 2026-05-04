"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type SavedEntry = {
  savedAt: string;
  waiter: { id: string; name?: string | null; verificationTier: string; waiterPassport?: { score: number; currentlyAvailable: boolean } | null };
};

function Initials({ name }: { name?: string | null }) {
  const l = name ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?";
  return (
    <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 font-black text-sm flex items-center justify-center border-2 border-orange-200 flex-shrink-0">
      {l}
    </div>
  );
}

export default function HeadhunterDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [saved, setSaved] = useState<SavedEntry[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user.role !== "HEADHUNTER") router.push("/");
  }, [status, session, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/headhunter/saved")
      .then((r) => r.json())
      .then((d) => setSaved(Array.isArray(d) ? d.slice(0, 5) : []));
  }, [status]);

  if (status === "loading") return null;

  const name = session?.user.name ?? "Headhunter";

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-8">
        {/* Header */}
        <div className="dash-card p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest">Headhunter</p>
            <h1 className="text-2xl font-black text-neutral-900 mt-0.5">{name}</h1>
            <p className="text-sm text-neutral-500">Pronađi i povežis najboljim ugostiteljskim talentima</p>
          </div>
          <div className="flex gap-3">
            <Link href="/headhunter/search" className="btn-dash-orange px-5 py-2.5 text-sm">
              🔍 Pretraži konobara
            </Link>
            <Link href="/headhunter/saved" className="btn-dash-outline px-5 py-2.5 text-sm">
              🔖 Sačuvani ({saved.length})
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { icon: "🔖", label: "Sačuvanih profila", value: saved.length },
            { icon: "✅", label: "Dostupnih konobara", value: saved.filter(s => s.waiter?.waiterPassport?.currentlyAvailable).length },
            { icon: "⭐", label: "Prosečan skor", value: saved.length
                ? Math.round(saved.reduce((a, s) => a + (s.waiter?.waiterPassport?.score ?? 0), 0) / saved.length)
                : "—"
            },
          ].map(({ icon, label, value }) => (
            <div key={label} className="dash-card p-5 text-center">
              <p className="text-2xl mb-1">{icon}</p>
              <p className="text-2xl font-black text-neutral-900">{value}</p>
              <p className="text-xs text-neutral-400 font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Recent saved */}
        {saved.length > 0 && (
          <div className="dash-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-neutral-900">Nedavno sačuvani</h2>
              <Link href="/headhunter/saved" className="text-xs text-orange-500 font-bold hover:underline">Vidi sve →</Link>
            </div>
            <div className="flex flex-col gap-3">
              {saved.map((s) => (
                <div key={s.waiter?.id} className="flex items-center gap-3">
                  <Initials name={s.waiter?.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-neutral-900 truncate">{s.waiter?.name ?? "Konobar"}</p>
                    <p className="text-xs text-neutral-400">
                      {s.waiter?.waiterPassport?.currentlyAvailable ? "✓ Dostupan" : "Nije dostupan"}
                      {s.waiter?.waiterPassport?.score ? ` · ${Math.round(s.waiter.waiterPassport.score)} pts` : ""}
                    </p>
                  </div>
                  {s.waiter?.waiterPassport?.score !== undefined && (
                    <span className="text-xs font-black text-orange-500 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full flex-shrink-0">
                      {Math.round(s.waiter.waiterPassport.score)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {saved.length === 0 && (
          <div className="dash-card p-10 text-center flex flex-col gap-3 items-center">
            <p className="text-4xl">🔍</p>
            <p className="font-bold text-neutral-900">Još nema sačuvanih profila</p>
            <p className="text-sm text-neutral-400">Pretraži konobara i sačuvaj najperspektivnije.</p>
            <Link href="/headhunter/search" className="btn-dash-orange px-6 py-2.5 text-sm mt-2">
              Počni pretragu
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
