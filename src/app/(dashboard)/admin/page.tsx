"use client";

import { useRef, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* ── Skeleton ────────────────────────────────────────────────────────────── */

function Sk({ className = "" }: { className?: string }) {
  return <div className={`bg-white/10 rounded-xl animate-pulse ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: "#0e0700" }}>
      <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-8 animate-pulse">
        <div className="flex flex-col gap-2">
          <Sk className="h-8 w-40" />
          <Sk className="h-4 w-60" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[0,1,2,3].map(i => <Sk key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => <Sk key={i} className="h-24 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0,1,2].map(i => <Sk key={i} className="h-36 rounded-2xl" />)}
        </div>
      </div>
    </div>
  );
}

/* ── Types ───────────────────────────────────────────────────────────────── */

type PlatformStats = {
  users: { waiters: number; venueOwners: number; headhunters: number; admins: number; total: number };
  passports: { total: number; free: number; pro: number; proPlus: number; available: number; verified: number };
  venues: number;
  jobs: { open: number; redAlert: number };
  applications: { total: number; pending: number };
  reviews: { pending: number; published: number; disputed: number; removed: number };
  sanitary: { pending: number };
  payments: { totalSuccess: number; revenueThisMonth: number };
};

type ActionStats = {
  pendingVerifications: number;
  disputedReviews: number;
  zones: number;
};

/* ── Stat card components ────────────────────────────────────────────────── */

function BigStat({
  icon, label, value, sub, color = "neutral",
}: {
  icon: string; label: string; value: string | number; sub?: string;
  color?: "neutral" | "orange" | "green" | "red" | "blue";
}) {
  const colors = {
    neutral: { bg: "bg-white/5",        border: "border-white/10",        num: "text-white",       icon: "bg-white/10" },
    orange:  { bg: "bg-orange-500/10",  border: "border-orange-500/20",   num: "text-orange-400",  icon: "bg-orange-500/20" },
    green:   { bg: "bg-emerald-500/10", border: "border-emerald-500/20",  num: "text-emerald-400", icon: "bg-emerald-500/20" },
    red:     { bg: "bg-red-500/10",     border: "border-red-500/20",      num: "text-red-400",     icon: "bg-red-500/20" },
    blue:    { bg: "bg-blue-500/10",    border: "border-blue-500/20",     num: "text-blue-400",    icon: "bg-blue-500/20" },
  };
  const c = colors[color];
  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-3 ${c.bg} ${c.border}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${c.icon}`}>{icon}</div>
      <div>
        <p className={`text-2xl font-black leading-none ${c.num}`}>{value}</p>
        {sub && <p className="text-xs text-white/40 mt-0.5">{sub}</p>}
      </div>
      <p className="text-xs font-bold text-white/50 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-white/60">{label}</span>
      <span className={`text-sm font-black ${accent ? "text-orange-400" : "text-white"}`}>{value}</span>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">{icon}</span>
        <h2 className="text-xs font-black text-white/40 uppercase tracking-widest">{title}</h2>
      </div>
      {children}
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────────────────── */

const NAV = [
  {
    href: "/admin/verifications",
    icon: "📋",
    title: "Sanitarne knjižice",
    desc: "Pregled i odobravanje zahteva za verifikaciju.",
    countKey: "pendingVerifications" as keyof ActionStats,
    countLabel: "na čekanju",
    alert: true,
  },
  {
    href: "/admin/moderation",
    icon: "🔍",
    title: "Moderacija recenzija",
    desc: "Disputed recenzije — objavi ili ukloni.",
    countKey: "disputedReviews" as keyof ActionStats,
    countLabel: "na pregledu",
    alert: true,
  },
  {
    href: "/admin/analytics/zones",
    icon: "🗺️",
    title: "Zone analitike",
    desc: "Upravljanje investicionim i komercijalnim zonama.",
    countKey: "zones" as keyof ActionStats,
    countLabel: "zona",
    alert: false,
  },
];

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const spotlightRef = useRef<HTMLDivElement>(null);
  const [platform, setPlatform] = useState<PlatformStats | null>(null);
  const [actions, setActions]   = useState<ActionStats | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user.role !== "ADMIN") router.push("/");
  }, [status, session, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    Promise.all([
      fetch("/api/admin/stats").then(r => r.ok ? r.json() : null),
      fetch("/api/verification/sanitary").then(r => r.ok ? r.json() : []),
      fetch("/api/admin/reviews").then(r => r.ok ? r.json() : []),
      fetch("/api/admin/zones").then(r => r.ok ? r.json() : []),
    ]).then(([stats, verif, reviews, zones]) => {
      if (stats) setPlatform(stats);
      setActions({
        pendingVerifications: Array.isArray(verif) ? verif.length : 0,
        disputedReviews: Array.isArray(reviews) ? reviews.length : 0,
        zones: Array.isArray(zones) ? zones.length : 0,
      });
    }).catch(() => setActions({ pendingVerifications: 0, disputedReviews: 0, zones: 0 }));
  }, [status]);

  if (status === "loading" || !actions) return <DashboardSkeleton />;

  const totalAlerts = (actions.pendingVerifications + actions.disputedReviews);

  return (
    <div
      className="min-h-screen relative"
      style={{
        background: "#0e0700",
        backgroundImage: "linear-gradient(rgba(249,115,22,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.03) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
      onMouseMove={e => {
        if (!spotlightRef.current) return;
        spotlightRef.current.style.background =
          `radial-gradient(600px circle at ${e.clientX}px ${e.clientY}px, rgba(249,115,22,0.06), transparent 70%)`;
      }}
    >
      {/* Spotlight */}
      <div ref={spotlightRef} className="pointer-events-none fixed inset-0 z-0" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10 flex flex-col gap-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black text-orange-500 uppercase tracking-widest">eKonobar</span>
              {totalAlerts > 0 && (
                <span className="text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                  {totalAlerts} akcija
                </span>
              )}
            </div>
            <h1 className="text-3xl font-black text-white">Admin Panel</h1>
            <p className="text-sm text-white/40 mt-0.5">Pregled platforme u realnom vremenu</p>
          </div>
          <div className="flex gap-2">
            {NAV.filter(n => n.alert && actions[n.countKey] > 0).map(n => (
              <Link
                key={n.href}
                href={n.href}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black px-4 py-2 rounded-xl transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                {actions[n.countKey]} {n.countLabel}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Hero stats row ───────────────────────────────────────────── */}
        {platform && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <BigStat icon="👥" label="Ukupno korisnika" value={platform.users.total} color="blue" />
            <BigStat icon="🏪" label="Aktivnih lokala" value={platform.venues} color="neutral" />
            <BigStat icon="💳" label="Aktivnih pretplata" value={platform.passports.pro + platform.passports.proPlus} sub={`${platform.passports.pro} PRO · ${platform.passports.proPlus} PRO+`} color="orange" />
            <BigStat
              icon="💰"
              label="Prihod ovog meseca"
              value={platform.payments.revenueThisMonth > 0 ? `${platform.payments.revenueThisMonth.toLocaleString("sr-RS")} RSD` : "0 RSD"}
              color={platform.payments.revenueThisMonth > 0 ? "green" : "neutral"}
            />
          </div>
        )}

        {/* ── Middle section ───────────────────────────────────────────── */}
        {platform && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Korisnici */}
            <SectionCard title="Korisnici" icon="👤">
              <MiniStat label="Konobari" value={platform.users.waiters} />
              <MiniStat label="Vlasnici lokala" value={platform.users.venueOwners} />
              <MiniStat label="Headhunteri" value={platform.users.headhunters} />
              <MiniStat label="Admini" value={platform.users.admins} />
            </SectionCard>

            {/* Waiter Passport */}
            <SectionCard title="Waiter Passport" icon="🪪">
              <MiniStat label="Kreirani pasoši" value={platform.passports.total} />
              <MiniStat label="FREE tier" value={platform.passports.free} />
              <MiniStat label="PRO tier" value={platform.passports.pro} accent={platform.passports.pro > 0} />
              <MiniStat label="PRO+ tier" value={platform.passports.proPlus} accent={platform.passports.proPlus > 0} />
              <MiniStat label="Dostupni" value={platform.passports.available} />
              <MiniStat label="Verifikovani (GOLD+)" value={platform.passports.verified} accent={platform.passports.verified > 0} />
            </SectionCard>

            {/* Platforma */}
            <SectionCard title="Platforma" icon="📊">
              <MiniStat label="Otvoreni oglasi" value={platform.jobs.open} />
              <MiniStat label="Red Alert oglasi" value={platform.jobs.redAlert} accent={platform.jobs.redAlert > 0} />
              <MiniStat label="Ukupno prijava" value={platform.applications.total} />
              <MiniStat label="Prijave na čekanju" value={platform.applications.pending} accent={platform.applications.pending > 0} />
              <MiniStat label="Uspešnih plaćanja" value={platform.payments.totalSuccess} />
            </SectionCard>

          </div>
        )}

        {/* ── Reviews + quick stats ────────────────────────────────────── */}
        {platform && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SectionCard title="Recenzije" icon="⭐">
              <div className="grid grid-cols-2 gap-3 mt-1">
                {[
                  { label: "Objavljene", value: platform.reviews.published, color: "text-emerald-400" },
                  { label: "Na čekanju",  value: platform.reviews.pending,   color: platform.reviews.pending > 0 ? "text-orange-400" : "text-white" },
                  { label: "Disputed",    value: platform.reviews.disputed,  color: platform.reviews.disputed > 0 ? "text-red-400" : "text-white" },
                  { label: "Uklonjene",   value: platform.reviews.removed,   color: "text-white/50" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white/5 rounded-xl p-3 flex flex-col gap-0.5">
                    <p className={`text-xl font-black ${color}`}>{value}</p>
                    <p className="text-[11px] text-white/40 font-medium">{label}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Verifikacije i sanitarne" icon="✅">
              <div className="grid grid-cols-2 gap-3 mt-1">
                {[
                  { label: "Knjižice čekaju", value: platform.sanitary.pending, color: platform.sanitary.pending > 0 ? "text-orange-400" : "text-white" },
                  { label: "Ukupno plaćanja", value: platform.payments.totalSuccess, color: "text-white" },
                  { label: "Zone analitike",  value: actions.zones, color: "text-blue-400" },
                  { label: "Prijavljeni",     value: platform.users.total, color: "text-white" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white/5 rounded-xl p-3 flex flex-col gap-0.5">
                    <p className={`text-xl font-black ${color}`}>{value}</p>
                    <p className="text-[11px] text-white/40 font-medium">{label}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── Action cards ─────────────────────────────────────────────── */}
        <div>
          <h2 className="text-xs font-black text-white/30 uppercase tracking-widest mb-4">Upravljanje</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {NAV.map(({ href, icon, title, desc, countKey, countLabel, alert }) => {
              const count = actions[countKey];
              const hasAlert = alert && count > 0;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`group rounded-2xl border p-5 flex flex-col gap-4 transition-all hover:scale-[1.01] ${
                    hasAlert
                      ? "border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/15"
                      : "border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className={`text-2xl w-10 h-10 rounded-xl flex items-center justify-center ${
                      hasAlert ? "bg-orange-500/20" : "bg-white/10"
                    }`}>{icon}</span>
                    {hasAlert ? (
                      <span className="flex items-center gap-1.5 bg-orange-500 text-white text-xs font-black px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        {count} {countLabel}
                      </span>
                    ) : (
                      <span className="bg-white/10 text-white/50 text-xs font-bold px-2.5 py-1 rounded-full">
                        {count} {countLabel}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className={`font-black text-sm transition-colors ${
                      hasAlert ? "text-orange-300 group-hover:text-orange-200" : "text-white group-hover:text-white/90"
                    }`}>{title}</p>
                    <p className="text-xs text-white/40 mt-0.5">{desc}</p>
                  </div>
                  <p className="text-xs text-white/30 group-hover:text-orange-400 transition-colors font-bold">
                    Otvori →
                  </p>
                </Link>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
