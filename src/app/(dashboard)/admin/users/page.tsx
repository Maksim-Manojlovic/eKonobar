"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PASSPORT_TIER_COLORS } from "@/lib/display-maps";
import { timeAgo } from "../admin-helpers";

type Passport = { passportTier: string; score: number; subscriptionExpiresAt: string | null };
type User = {
  id: string; name: string | null; email: string; role: string;
  verificationTier: string; createdAt: string; deletedAt: string | null;
  waiterPassport: Passport | null;
};

const ROLES = ["", "WAITER", "VENUE_OWNER", "HEADHUNTER", "ADMIN"];

const ROLE_LABELS: Record<string, string> = {
  WAITER: "Konobar", VENUE_OWNER: "Vlasnik", HEADHUNTER: "Headhunter", ADMIN: "Admin",
};

function Sk({ className = "" }: { className?: string }) {
  return <div className={`bg-white/8 rounded-xl animate-pulse ${className}`} />;
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers]     = useState<User[]>([]);
  const [total, setTotal]     = useState(0);
  const [pages, setPages]     = useState(1);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState("");
  const [role, setRole]       = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user.role !== "ADMIN") router.push("/");
  }, [status, session, router]);

  const fetchUsers = useCallback(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), ...(search && { search }), ...(role && { role }) });
    fetch(`/api/admin/users?${q}`)
      .then(r => r.ok ? r.json() : { users: [], total: 0, pages: 1 })
      .then(d => { setUsers(d.users ?? []); setTotal(d.total ?? 0); setPages(d.pages ?? 1); })
      .finally(() => setLoading(false));
  }, [status, page, search, role]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Reset to page 1 on filter change
  useEffect(() => { setPage(1); }, [search, role]);

  async function patch(id: string, body: Record<string, unknown>) {
    setActing(id);
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setActing(null);
    setConfirm(null);
    fetchUsers();
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
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-white/30 hover:text-white/60 text-sm transition-colors">← Admin</Link>
          <span className="text-white/20">/</span>
          <h1 className="text-xl font-black text-white">Upravljanje korisnicima</h1>
          <span className="ml-auto text-xs text-white/40 bg-white/5 px-3 py-1 rounded-full">{total} korisnika</span>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pretraži po imenu ili email-u…"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50"
          />
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50"
          >
            <option value="">Svi tipovi</option>
            {ROLES.filter(Boolean).map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 bg-white/5 border-b border-white/10 text-[11px] font-black text-white/30 uppercase tracking-widest">
            <span>Korisnik</span>
            <span className="hidden sm:block">Tip</span>
            <span className="hidden sm:block">Passport</span>
            <span className="hidden sm:block">Registrovan</span>
            <span>Akcija</span>
          </div>

          {loading ? (
            <div className="flex flex-col gap-0">
              {[0,1,2,3,4,5,6].map(i => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-4 border-b border-white/5 last:border-0 animate-pulse">
                  <div className="flex flex-col gap-1.5">
                    <Sk className="h-4 w-32" />
                    <Sk className="h-3 w-44" />
                  </div>
                  <Sk className="hidden sm:block h-6 w-20 rounded-full self-center" />
                  <Sk className="hidden sm:block h-6 w-14 rounded-full self-center" />
                  <Sk className="hidden sm:block h-4 w-16 self-center" />
                  <Sk className="h-7 w-16 rounded-lg self-center" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-white/30 text-sm">Nema rezultata</div>
          ) : (
            <div>
              {users.map(u => {
                const isDeleted = !!u.deletedAt;
                const passport = u.waiterPassport;
                const isProActive = passport?.subscriptionExpiresAt
                  ? new Date(passport.subscriptionExpiresAt) > new Date()
                  : false;
                const tier = isProActive ? (passport?.passportTier ?? "FREE") : "FREE";

                return (
                  <div
                    key={u.id}
                    className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-4 border-b border-white/5 last:border-0 transition-colors hover:bg-white/[0.02] ${isDeleted ? "opacity-40" : ""}`}
                  >
                    {/* Name + email */}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {u.name ?? <span className="text-white/30 italic">bez imena</span>}
                      </p>
                      <p className="text-xs text-white/40 truncate">{u.email}</p>
                      {isDeleted && <p className="text-[10px] text-red-400 font-bold">OBRISAN</p>}
                    </div>

                    {/* Role */}
                    <div className="hidden sm:flex items-center">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/8 text-white/70">
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </div>

                    {/* Passport tier */}
                    <div className="hidden sm:flex items-center">
                      {passport ? (
                        <span className={`text-xs font-black px-2.5 py-1 rounded-full ${PASSPORT_TIER_COLORS[tier] ?? PASSPORT_TIER_COLORS.FREE}`}>
                          {tier.replace("_", "+")}
                        </span>
                      ) : (
                        <span className="text-xs text-white/20">—</span>
                      )}
                    </div>

                    {/* Date */}
                    <div className="hidden sm:flex items-center">
                      <span className="text-xs text-white/30">{timeAgo(u.createdAt)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {isDeleted ? (
                        <button
                          onClick={() => patch(u.id, { action: "restore" })}
                          disabled={acting === u.id}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                        >
                          {acting === u.id ? "…" : "Vrati"}
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirm({ id: u.id, name: u.name ?? u.email })}
                          disabled={acting === u.id}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >
                          Briši
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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

      {/* Delete confirm modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a0e02] border border-white/10 rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4">
            <h2 className="font-black text-white text-lg">Obriši korisnika?</h2>
            <p className="text-sm text-white/60">
              <span className="font-bold text-white">{confirm.name}</span> će biti soft-deletovan. Podaci ostaju u bazi.
            </p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:bg-white/5 transition-colors"
              >
                Otkaži
              </button>
              <button
                onClick={() => patch(confirm.id, { action: "delete" })}
                disabled={!!acting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-black hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {acting ? "…" : "Obriši"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
