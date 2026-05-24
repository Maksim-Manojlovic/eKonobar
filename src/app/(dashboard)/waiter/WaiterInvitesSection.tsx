"use client";

import { useState } from "react";
import type { InviteItem } from "./waiter-types";
import { formatDate } from "@/lib/display-maps";
import { getInitials } from "@/lib/format-utils";
import { InvitesSkeleton } from "./waiter-helpers";

/* ── Section: Invites ────────────────────────────────────────────────────── */

export function InvitesSection({ invites, loading, onRespond }: {
  invites: InviteItem[]; loading: boolean;
  onRespond: (id: string, status: "ACCEPTED" | "DECLINED") => Promise<void>;
}) {
  const [responding, setResponding] = useState<string | null>(null);

  const handle = async (id: string, status: "ACCEPTED" | "DECLINED") => {
    setResponding(id);
    await onRespond(id, status);
    setResponding(null);
  };

  if (loading) return <InvitesSkeleton />;

  const pending = invites.filter(i => i.status === "PENDING");
  const past    = invites.filter(i => i.status !== "PENDING");

  const venueName = (inv: InviteItem) => inv.sender.venues[0]?.name ?? inv.sender.name ?? "Lokal";

  return (
    <>
      <h2 className="font-black text-white">Pozivnice</h2>
      {pending.length === 0 && past.length === 0 && (
        <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nema pozivnica</div>
      )}
      {pending.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-neutral-600">Na čekanju</h3>
          {pending.map(inv => (
            <div key={inv.id} className="dash-card p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold flex-shrink-0">
                  {getInitials(venueName(inv))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-neutral-900">{venueName(inv)}</div>
                  {inv.message && (
                    <p className="text-sm text-neutral-500 mt-1 leading-relaxed italic">&ldquo;{inv.message}&rdquo;</p>
                  )}
                  <div className="text-xs text-neutral-400 mt-1">{formatDate(inv.createdAt)}</div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button onClick={() => handle(inv.id, "ACCEPTED")} disabled={responding === inv.id}
                    className="btn-dash-orange px-3 py-1.5 text-[11px] disabled:opacity-50">
                    {responding === inv.id ? "..." : "Prihvati"}
                  </button>
                  <button onClick={() => handle(inv.id, "DECLINED")} disabled={responding === inv.id}
                    className="btn-dash-outline px-3 py-1.5 text-[11px] disabled:opacity-50">
                    Odbij
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {past.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-neutral-600">Istorija</h3>
          {past.map(inv => (
            <div key={inv.id} className="dash-card p-5 opacity-70">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 font-bold flex-shrink-0">
                  {getInitials(venueName(inv))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-neutral-700">{venueName(inv)}</div>
                  <div className="text-xs text-neutral-400 mt-1">{formatDate(inv.createdAt)}</div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${inv.status === "ACCEPTED" ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-400"}`}>
                  {inv.status === "ACCEPTED" ? "Prihvaćena" : "Odbijena"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
