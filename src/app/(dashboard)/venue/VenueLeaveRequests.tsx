"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { Initials } from "@/components/ui/PassportWidgets";
import {
  LEAVE_TYPE_LABELS, LEAVE_TYPE_COLORS, LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS,
  DEPARTMENT_LABELS, POSITION_LABELS, formatDate,
} from "@/lib/formatting/display-maps";
import { Sk } from "./venue-helpers";
import type { LeaveRequestRow, LeaveRequestsResponse } from "./venue-types";

type StatusFilter = "PENDING" | "APPROVED" | "ALL";

/* ── Reject dialog ───────────────────────────────────────────────────────── */

function RejectModal({ request, onClose, onConfirm, busy }: {
  request: LeaveRequestRow;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  busy: boolean;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
         onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 flex flex-col gap-4"
           onClick={e => e.stopPropagation()}>
        <h3 className="font-black text-lg text-neutral-900">
          Odbij zahtev — {request.waiter.name ?? "Radnik"}
        </h3>
        <p className="text-xs text-neutral-500">
          {formatDate(request.startDate)} – {formatDate(request.endDate)} ({request.days} d)
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-neutral-500 uppercase">Razlog (opciono)</span>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
            placeholder="npr. Sezona je, potrebni ste u tom periodu"
            className="px-3 py-2 rounded-xl border border-neutral-200 text-sm resize-none" />
          <span className="text-[10px] text-neutral-400">Radnik će videti ovaj razlog.</span>
        </label>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-bold text-neutral-600 hover:bg-neutral-50">
            Nazad
          </button>
          <button onClick={() => onConfirm(reason)} disabled={busy}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-50">
            {busy ? "…" : "Odbij"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Request row ─────────────────────────────────────────────────────────── */

function RequestRow({ r, hasKitchen, busy, onApprove, onReject, onCancel }: {
  r: LeaveRequestRow;
  hasKitchen: boolean;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="dash-card p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        {r.waiter.image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={r.waiter.image} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
          : <Initials name={r.waiter.name} />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-black text-sm text-neutral-900 truncate">{r.waiter.name ?? "Radnik"}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${LEAVE_TYPE_COLORS[r.type]}`}>
              {LEAVE_TYPE_LABELS[r.type] ?? r.type}
            </span>
            {hasKitchen && (
              <span className="text-[10px] text-neutral-400">{DEPARTMENT_LABELS[r.department]}</span>
            )}
          </div>
          <p className="text-xs text-neutral-600 mt-0.5 font-medium">
            {formatDate(r.startDate)} – {formatDate(r.endDate)}
            <span className="text-neutral-400"> · {r.days} {r.days === 1 ? "dan" : "dana"}</span>
          </p>
          <p className="text-[10px] text-neutral-400">
            {POSITION_LABELS[r.staff.position] ?? r.staff.position}
            {r.autoApproved && " · automatski odobreno"}
          </p>
          {r.reason && <p className="text-xs text-neutral-600 mt-1.5 italic">„{r.reason}”</p>}
          {r.rejectReason && (
            <p className="text-xs text-red-600 mt-1.5">Odbijeno: {r.rejectReason}</p>
          )}
          {r.attachmentUrl && (
            <a href={r.attachmentUrl} target="_blank" rel="noopener noreferrer"
               className="text-xs text-orange-600 font-bold hover:underline mt-1 inline-block">
              Pogledaj doznaku →
            </a>
          )}
        </div>

        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${LEAVE_STATUS_COLORS[r.status]}`}>
          {LEAVE_STATUS_LABELS[r.status]}
        </span>
      </div>

      {r.status === "PENDING" && (
        <div className="flex gap-2">
          <button onClick={onApprove} disabled={busy}
            className="flex-1 px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-50">
            Odobri
          </button>
          <button onClick={onReject} disabled={busy}
            className="flex-1 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 disabled:opacity-50">
            Odbij
          </button>
        </div>
      )}

      {r.status === "APPROVED" && new Date(r.endDate) >= new Date() && (
        <button onClick={onCancel} disabled={busy}
          className="px-3 py-1.5 rounded-xl border border-neutral-200 text-neutral-500 text-xs font-bold hover:bg-neutral-50 self-start disabled:opacity-50">
          Poništi odobrenje
        </button>
      )}
    </div>
  );
}

/* ── Queue ───────────────────────────────────────────────────────────────── */

export default function VenueLeaveRequests({ venueId, hasKitchen, department }: {
  venueId: string;
  hasKitchen: boolean;
  department: "FOH" | "BOH" | null;
}) {
  const [filter, setFilter]     = useState<StatusFilter>("PENDING");
  const [busyId, setBusyId]     = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<LeaveRequestRow | null>(null);

  const { data, isLoading, mutate } = useApi<LeaveRequestsResponse>(
    `/api/leave/requests?venueId=${venueId}`,
    { enabled: !!venueId },
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map(i => <Sk key={i} className="h-28" />)}
      </div>
    );
  }

  const all = data?.requests ?? [];
  const shown = all
    .filter(r => (filter === "ALL" ? true : r.status === filter))
    .filter(r => (department ? r.department === department : true));

  const pendingCount = all.filter(r => r.status === "PENDING").length;

  const act = async (r: LeaveRequestRow, action: "approve" | "reject" | "cancel", rejectReason?: string) => {
    setBusyId(r.id);
    setError(null);
    try {
      const res = await fetch(`/api/leave/requests/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(rejectReason ? { rejectReason } : {}) }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Greška");
        return;
      }
      setRejecting(null);
      await mutate();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="flex gap-2 flex-wrap items-center">
        {(["PENDING", "APPROVED", "ALL"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
              filter === f ? "bg-orange-500 text-white border-orange-500"
                           : "bg-white text-neutral-600 border-neutral-200 hover:border-orange-300"
            }`}>
            {f === "PENDING" ? "Na čekanju" : f === "APPROVED" ? "Odobreni" : "Svi"}
            {f === "PENDING" && pendingCount > 0 && (
              <span className="ml-1.5 bg-white/25 px-1.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      {shown.length === 0 ? (
        <div className="dash-card p-8 text-center">
          <p className="text-sm font-bold text-neutral-900">
            {filter === "PENDING" ? "Nema zahteva na čekanju" : "Nema zahteva"}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {filter === "PENDING"
              ? "Zahtevi koji prolaze sve provere se odobravaju automatski — ovde stižu samo oni kojima treba vaša odluka."
              : "Kada radnici zatraže odmor, videćete ih ovde."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map(r => (
            <RequestRow key={r.id} r={r} hasKitchen={hasKitchen} busy={busyId === r.id}
              onApprove={() => act(r, "approve")}
              onReject={() => setRejecting(r)}
              onCancel={() => act(r, "cancel")} />
          ))}
        </div>
      )}

      {rejecting && (
        <RejectModal request={rejecting} busy={busyId === rejecting.id}
          onClose={() => setRejecting(null)}
          onConfirm={(reason) => act(rejecting, "reject", reason)} />
      )}
    </>
  );
}
