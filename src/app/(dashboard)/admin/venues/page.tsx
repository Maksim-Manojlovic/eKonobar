"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { VENUE_TYPE_LABELS } from "@/lib/display-maps";

type Owner = { id: string; name: string | null; email: string };
type Venue = {
  id: string; name: string; venueType: string; municipality: string; city: string;
  isActive: boolean; trustScore: number; createdAt: string; deletedAt: string | null;
  owner: Owner;
  _count: { jobPosts: number; reviews: number };
};


const VENUE_TYPES = ["", "RESTAURANT", "CAFE", "BAR", "CATERING", "HOTEL", "EVENT"];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "danas";
  if (days === 1) return "juče";
  if (days < 30) return `pre ${days}d`;
  if (days < 365) return `pre ${Math.floor(days / 30)}m`;
  return `pre ${Math.floor(days / 365)}g`;
}

function Sk({ className = "" }: { className?: string }) {
  return <div className={`bg-white/8 rounded-xl animate-pulse ${className}`} />;
}

export default function AdminVenuesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [venues, setVenues]   = useState<Venue[]>([]);
  const [total, setTotal]     = useState(0);
  const [pages, setPages]     = useState(1);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState("");
  const [type, setType]       = useState("");
  const [active, setActive]   = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user.role !== "ADMIN") router.push("/");
  }, [status, session, router]);

  const fetchVenues = useCallback(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    const q = new URLSearchParams({
      page: String(page),
      ...(search && { search }),
      ...(type   && { type }),
      ...(active && { active }),
    });
    fetch(`/api/admin/venues?${q}`)
      .then(r => r.ok ? r.json() : { venues: [], total: 0, pages: 1 })
      .then(d => { setVenues(d.venues ?? []); setTotal(d.total ?? 0); setPages(d.pages ?? 1); })
      .finally(() => setLoading(false));
  }, [status, page, search, type, active]);

  useEffect(() => { fetchVenues(); }, [fetchVenues]);
  useEffect(() => { setPage(1); }, [search, type, active]);

  async function hardDelete(id: string) {
    setDeleting(id);
    const res = await fetch(`/api/admin/venues/${id}`, { method: "DELETE" });
    setDeleting(null);
    setConfirm(null);
    if (res.ok) fetchVenues();
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: "#0e0700",
        backgroundImage: "linear-gradient(rgba(249,115,22,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.03) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
    >
      <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/admin" className="text-white/30 hover:text-white/60 text-sm transition-colors">← Admin</Link>
          <span className="text-white/20">/</span>
          <h1 className="text-xl font-black text-white">Upravljanje lokalima</h1>
          <span className="ml-auto text-xs text-white/40 bg-white/5 px-3 py-1 rounded-full">{total} lokala</span>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pretraži po nazivu, gradu, opštini, vlasniku…"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50"
          />
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50"
          >
            <option value="">Svi tipovi</option>
            {VENUE_TYPES.filter(Boolean).map(t => (
              <option key={t} value={t}>{VENUE_TYPE_LABELS[t] ?? t}</option>
            ))}
          </select>
          <select
            value={active}
            onChange={e => setActive(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50"
          >
            <option value="">Svi statusi</option>
            <option value="true">Aktivni</option>
            <option value="false">Neaktivni</option>
          </select>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-5 py-3 bg-white/5 border-b border-white/10 text-[11px] font-black text-white/30 uppercase tracking-widest">
            <span>Lokal</span>
            <span className="hidden md:block">Tip</span>
            <span className="hidden sm:block">Oglasi / Rec.</span>
            <span className="hidden sm:block">Score</span>
            <span className="hidden sm:block">Dodat</span>
            <span>Akcija</span>
          </div>

          {loading ? (
            <div className="flex flex-col gap-0">
              {[0,1,2,3,4,5,6].map(i => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-5 py-4 border-b border-white/5 last:border-0 animate-pulse">
                  <div className="flex flex-col gap-1.5">
                    <Sk className="h-4 w-40" />
                    <Sk className="h-3 w-56" />
                  </div>
                  <Sk className="hidden md:block h-6 w-20 rounded-full self-center" />
                  <Sk className="hidden sm:block h-4 w-16 self-center" />
                  <Sk className="hidden sm:block h-4 w-12 self-center" />
                  <Sk className="hidden sm:block h-4 w-14 self-center" />
                  <Sk className="h-7 w-16 rounded-lg self-center" />
                </div>
              ))}
            </div>
          ) : venues.length === 0 ? (
            <div className="py-16 text-center text-white/30 text-sm">Nema rezultata</div>
          ) : (
            <div>
              {venues.map(v => (
                <div
                  key={v.id}
                  className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-5 py-4 border-b border-white/5 last:border-0 transition-colors hover:bg-white/[0.02] ${!v.isActive ? "opacity-50" : ""}`}
                >
                  {/* Name + location + owner */}
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white truncate">{v.name}</p>
                      {!v.isActive && (
                        <span className="text-[10px] font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full flex-shrink-0">INACTIVE</span>
                      )}
                    </div>
                    <p className="text-xs text-white/40 truncate">{v.municipality}, {v.city}</p>
                    <p className="text-xs text-white/30 truncate">
                      {v.owner.name ?? v.owner.email}
                    </p>
                  </div>

                  {/* Type */}
                  <div className="hidden md:flex items-center">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/8 text-white/70">
                      {VENUE_TYPE_LABELS[v.venueType] ?? v.venueType}
                    </span>
                  </div>

                  {/* Counts */}
                  <div className="hidden sm:flex items-center gap-1">
                    <span className="text-xs text-white/40">{v._count.jobPosts}j / {v._count.reviews}r</span>
                  </div>

                  {/* Trust score */}
                  <div className="hidden sm:flex items-center">
                    <span className={`text-xs font-black ${v.trustScore >= 70 ? "text-emerald-400" : v.trustScore >= 40 ? "text-orange-400" : "text-white/30"}`}>
                      {v.trustScore > 0 ? v.trustScore.toFixed(0) : "—"}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="hidden sm:flex items-center">
                    <span className="text-xs text-white/30">{timeAgo(v.createdAt)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <a
                      href={`/venues/${v.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
                    >
                      ↗
                    </a>
                    <button
                      onClick={() => setConfirm({ id: v.id, name: v.name })}
                      disabled={deleting === v.id}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      {deleting === v.id ? "…" : "Briši"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              ← Preth.
            </button>
            <span className="text-sm text-white/40">{page} / {pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              Sledeća →
            </button>
          </div>
        )}
      </div>

      {/* Hard-delete confirm modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a0e02] border border-white/10 rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4">
            <h2 className="font-black text-white text-lg">Trajno obriši lokal?</h2>
            <p className="text-sm text-white/60">
              <span className="font-bold text-white">{confirm.name}</span> i svi povezani podaci
              (oglasi, recenzije, smene, angažmani) će biti <span className="text-red-400 font-bold">trajno obrisani</span>.
              Ovo se ne može poništiti.
            </p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:bg-white/5 transition-colors"
              >
                Otkaži
              </button>
              <button
                onClick={() => hardDelete(confirm.id)}
                disabled={!!deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-black hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {deleting ? "…" : "Trajno obriši"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
