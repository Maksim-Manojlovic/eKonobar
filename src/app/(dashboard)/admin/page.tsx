"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function Sk({ className = "" }: { className?: string }) {
  return <div className={`bg-neutral-200 rounded-lg animate-pulse ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-6 animate-pulse">
        <div className="flex flex-col gap-1">
          <Sk className="h-7 w-36" />
          <Sk className="h-4 w-56" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[0,1,2,3].map(i => (
            <div key={i} className="dash-card p-4 flex flex-col gap-2">
              <Sk className="h-3 w-20" />
              <Sk className="h-8 w-14" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0,1,2].map(i => (
            <div key={i} className="dash-card p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <Sk className="w-10 h-10 rounded-xl" />
                <Sk className="h-6 w-16 rounded-full" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Sk className="h-4 w-32" />
                <Sk className="h-3 w-44" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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

function StatTile({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="dash-card p-4 flex flex-col gap-0.5">
      <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-black ${accent ? "text-orange-500" : "text-neutral-900"}`}>{value}</p>
      {sub && <p className="text-[11px] text-neutral-400">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-black text-neutral-400 uppercase tracking-wider">{children}</h2>;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
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

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8">

        <div>
          <h1 className="font-black text-2xl text-neutral-900">Admin Panel</h1>
          <p className="text-sm text-neutral-400 mt-1">eKonobar — upravljanje platformom</p>
        </div>

        {/* ── Korisnici ──────────────────────────────────────────────── */}
        {platform && (
          <>
            <div className="flex flex-col gap-3">
              <SectionTitle>Korisnici</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatTile label="Konobar" value={platform.users.waiters} />
                <StatTile label="Vlasnici lokala" value={platform.users.venueOwners} />
                <StatTile label="Headhunteri" value={platform.users.headhunters} />
                <StatTile label="Ukupno" value={platform.users.total} accent />
              </div>
            </div>

            {/* ── Pasoši ─────────────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <SectionTitle>Waiter Passport</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatTile label="Kreiran" value={platform.passports.total} />
                <StatTile label="FREE" value={platform.passports.free} />
                <StatTile label="PRO" value={platform.passports.pro} accent />
                <StatTile label="PRO+" value={platform.passports.proPlus} accent />
                <StatTile label="Dostupni" value={platform.passports.available} sub="currentlyAvailable" />
                <StatTile label="Verifikovani" value={platform.passports.verified} sub="GOLD / ID_VERIFIED" />
              </div>
            </div>

            {/* ── Platforma ──────────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <SectionTitle>Platforma</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatTile label="Lokali" value={platform.venues} />
                <StatTile label="Otvoreni oglasi" value={platform.jobs.open} />
                <StatTile label="Red Alert" value={platform.jobs.redAlert} accent />
                <StatTile label="Prijave" value={platform.applications.total} sub={`${platform.applications.pending} na čekanju`} />
              </div>
            </div>

            {/* ── Recenzije ──────────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <SectionTitle>Recenzije</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatTile label="Objavljene" value={platform.reviews.published} />
                <StatTile label="Na čekanju" value={platform.reviews.pending} accent={platform.reviews.pending > 0} />
                <StatTile label="Disputed" value={platform.reviews.disputed} accent={platform.reviews.disputed > 0} />
                <StatTile label="Uklonjene" value={platform.reviews.removed} />
              </div>
            </div>

            {/* ── Prihodi ────────────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <SectionTitle>Pretplate i prihodi</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <StatTile label="Uspešnih plaćanja" value={platform.payments.totalSuccess} />
                <StatTile
                  label="Prihod ovog meseca"
                  value={`${platform.payments.revenueThisMonth.toLocaleString("sr-RS")} RSD`}
                  accent={platform.payments.revenueThisMonth > 0}
                />
                <StatTile label="Sanitarne knjižice" value={platform.sanitary.pending} sub="čeka odobrenje" accent={platform.sanitary.pending > 0} />
              </div>
            </div>
          </>
        )}

        {/* ── Akcije ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <SectionTitle>Akcije</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {NAV.map(({ href, icon, title, desc, countKey, countLabel, alert }) => {
              const count = actions[countKey];
              const hasAlert = alert && count > 0;
              return (
                <Link
                  key={href}
                  href={href}
                  className="dash-card p-5 flex flex-col gap-3 hover:shadow-md hover:border-orange-200 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{icon}</span>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                      hasAlert ? "bg-orange-500 text-white" : "bg-neutral-100 text-neutral-500"
                    }`}>
                      {count} {countLabel}
                    </span>
                  </div>
                  <div>
                    <p className="font-black text-neutral-900 text-sm group-hover:text-orange-600 transition-colors">{title}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
