"use client";

import { useState, useEffect, useCallback } from "react";
import { type NotificationItem, TYPE_ICONS } from "./NotificationBell";
import { timeAgo } from "@/lib/formatting/utils";

const FILTER_GROUPS = [
  { key: "SVE",          label: "Sve" },
  { key: "RED_ALERT",    label: "Red Alert" },
  { key: "APPLICATIONS", label: "Prijave" },
  { key: "SHIFTS",        label: "Smene" },
  { key: "SWAPS",         label: "Zamene" },
  { key: "REVIEWS",       label: "Recenzije" },
  { key: "LEAVE",         label: "Odmori" },
];

const FILTER_MAP: Record<string, string[]> = {
  SVE:          [],
  RED_ALERT:    ["RED_ALERT_POSTED"],
  APPLICATIONS: ["APPLICATION_RECEIVED", "APPLICATION_STATUS_CHANGED"],
  SHIFTS:       ["SHIFT_CLAIMED", "SHIFT_ASSIGNED"],
  SWAPS:        ["SWAP_REQUESTED", "SWAP_RESOLVED"],
  REVIEWS:      ["REVIEW_PUBLISHED"],
  LEAVE:        ["LEAVE_REQUESTED", "LEAVE_RESOLVED", "LEAVE_CANCELLED"],
};

function dayLabel(iso: string): string {
  const d   = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const date  = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff  = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  if (diff === 0) return "Danas";
  if (diff === 1) return "Juče";
  return d.toLocaleDateString("sr-Latn-RS", { weekday: "long", day: "numeric", month: "long" });
}

function groupByDay(items: NotificationItem[]): { label: string; items: NotificationItem[] }[] {
  const map = new Map<string, NotificationItem[]>();
  for (const n of items) {
    const label = dayLabel(n.createdAt);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(n);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

export function NotificationsSection() {
  const [items,   setItems]   = useState<NotificationItem[]>([]);
  const [filter,  setFilter]  = useState("SVE");
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(() => {
    fetch("/api/notifications")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { setItems(data.notifications); setLoading(false); } })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    setItems(prev => prev.map(n => ({ ...n, read: true })));
  }

  async function markOneRead(id: string) {
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
  }

  const types = FILTER_MAP[filter];
  const filtered = types.length === 0 ? items : items.filter(n => types.includes(n.type));
  const groups   = groupByDay(filtered);
  const unread   = items.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filter + actions row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_GROUPS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === f.key
                  ? "bg-orange-500 text-white"
                  : "bg-white/8 text-white/60 hover:bg-white/12 hover:text-white/90"
              }`}
              style={filter !== f.key ? { background: "rgba(255,255,255,0.07)" } : {}}>
              {f.label}
            </button>
          ))}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-xs text-orange-400 font-semibold hover:underline flex-shrink-0">
            Označi sve pročitanim
          </button>
        )}
      </div>

      {/* Empty state */}
      {groups.length === 0 && (
        <div className="dash-card p-16 text-center">
          <div className="text-3xl mb-3">🔔</div>
          <p className="text-sm text-neutral-400">Nema obaveštenja</p>
        </div>
      )}

      {/* Day groups */}
      {groups.map(group => (
        <div key={group.label} className="flex flex-col gap-2">
          <h3 className="text-xs font-black text-white/70 uppercase tracking-wider px-1">{group.label}</h3>
          <div className="dash-card overflow-hidden divide-y divide-neutral-50">
            {group.items.map(n => (
              <div
                key={n.id}
                onClick={() => {
                  markOneRead(n.id);
                  if (n.link) window.location.href = n.link;
                }}
                className={`flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-neutral-50 transition-colors ${!n.read ? "bg-orange-50/70" : ""}`}>
                <span className="text-xl flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <span className={`text-sm leading-snug ${!n.read ? "font-bold text-neutral-900" : "font-semibold text-neutral-700"}`}>
                      {n.title}
                    </span>
                    <span className="text-[11px] text-neutral-400 flex-shrink-0 mt-0.5">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{n.body}</p>
                </div>
                {!n.read && (
                  <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-1.5" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {items.length === 0 && !loading && (
        <p className="text-center text-xs text-white/50">Prikazujemo poslednjih 30 obaveštenja</p>
      )}
      {items.length > 0 && (
        <p className="text-center text-xs text-white/50">Prikazujemo poslednjih {items.length} obaveštenja</p>
      )}
    </div>
  );
}
