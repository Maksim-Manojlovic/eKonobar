"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Stats = {
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
    countKey: "pendingVerifications" as keyof Stats,
    countLabel: "na čekanju",
  },
  {
    href: "/admin/moderation",
    icon: "🔍",
    title: "Moderacija recenzija",
    desc: "Disputed recenzije — objavi ili ukloni.",
    countKey: "disputedReviews" as keyof Stats,
    countLabel: "na pregledu",
  },
  {
    href: "/admin/analytics/zones",
    icon: "🗺️",
    title: "Zone analitike",
    desc: "Upravljanje investicionim i komercijalnim zonama.",
    countKey: "zones" as keyof Stats,
    countLabel: "zona",
  },
];

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user.role !== "ADMIN") router.push("/");
  }, [status, session, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    Promise.all([
      fetch("/api/verification/sanitary").then(r => r.ok ? r.json() : []),
      fetch("/api/admin/reviews").then(r => r.ok ? r.json() : []),
      fetch("/api/admin/zones").then(r => r.ok ? r.json() : []),
    ]).then(([verif, reviews, zones]) => {
      setStats({
        pendingVerifications: Array.isArray(verif) ? verif.length : 0,
        disputedReviews: Array.isArray(reviews) ? reviews.length : 0,
        zones: Array.isArray(zones) ? zones.length : 0,
      });
    }).catch(() => setStats({ pendingVerifications: 0, disputedReviews: 0, zones: 0 }));
  }, [status]);

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafaf8" }}>
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <div className="max-w-3xl mx-auto px-4 py-10 flex flex-col gap-6">

        <div>
          <h1 className="font-black text-2xl text-neutral-900">Admin Panel</h1>
          <p className="text-sm text-neutral-400 mt-1">eKonobar — upravljanje platformom</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {NAV.map(({ href, icon, title, desc, countKey, countLabel }) => {
            const count = stats?.[countKey];
            const hasAlert = countKey !== "zones" && count != null && count > 0;
            return (
              <Link
                key={href}
                href={href}
                className="dash-card p-5 flex flex-col gap-3 hover:shadow-md hover:border-orange-200 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{icon}</span>
                  {count != null && (
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                      hasAlert
                        ? "bg-orange-500 text-white"
                        : "bg-neutral-100 text-neutral-500"
                    }`}>
                      {count} {countLabel}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-black text-neutral-900 text-sm group-hover:text-orange-600 transition-colors">{title}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{desc}</p>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="dash-card p-5">
          <h3 className="font-bold text-neutral-900 text-sm mb-3">Brze akcije</h3>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/verifications" className="btn-dash-outline text-xs px-4 py-2">
              Verifikacije
            </Link>
            <Link href="/admin/moderation" className="btn-dash-outline text-xs px-4 py-2">
              Moderacija
            </Link>
            <Link href="/admin/analytics/zones" className="btn-dash-outline text-xs px-4 py-2">
              Zone
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
