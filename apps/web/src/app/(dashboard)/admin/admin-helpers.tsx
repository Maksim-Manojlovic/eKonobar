"use client";

export { timeAgo } from "@/lib/formatting/utils";

/* ── Skeleton ────────────────────────────────────────────────────────────── */

// Dark-pinned variant for the admin dashboard — all admin consumers import Sk from here.
import { Sk as SkBase } from "@/components/ui/Sk";
export function Sk({ className = "" }: { className?: string }) {
  return <SkBase dark className={className} />;
}

export function DashboardSkeleton() {
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

/* ── Stat card components ────────────────────────────────────────────────── */

type BigStatColor = "neutral" | "orange" | "green" | "red" | "blue";

const BIG_STAT_COLORS: Record<BigStatColor, { bg: string; border: string; num: string; icon: string }> = {
  neutral: { bg: "bg-white/5",        border: "border-white/10",        num: "text-white",       icon: "bg-white/10"       },
  orange:  { bg: "bg-orange-500/10",  border: "border-orange-500/20",   num: "text-orange-400",  icon: "bg-orange-500/20"  },
  green:   { bg: "bg-emerald-500/10", border: "border-emerald-500/20",  num: "text-emerald-400", icon: "bg-emerald-500/20" },
  red:     { bg: "bg-red-500/10",     border: "border-red-500/20",      num: "text-red-400",     icon: "bg-red-500/20"     },
  blue:    { bg: "bg-blue-500/10",    border: "border-blue-500/20",     num: "text-blue-400",    icon: "bg-blue-500/20"    },
};

export function BigStat({
  icon, label, value, sub, color = "neutral",
}: {
  icon: string; label: string; value: string | number; sub?: string;
  color?: BigStatColor;
}) {
  const c = BIG_STAT_COLORS[color];
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

export function MiniStat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-white/60">{label}</span>
      <span className={`text-sm font-black ${accent ? "text-orange-400" : "text-white"}`}>{value}</span>
    </div>
  );
}

export function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
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

