"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useWaiterSearch } from "@/hooks/useWaiterSearch";
import { Initials, VerifiedBadge, ScorePill } from "@/components/ui/PassportWidgets";
import {
  POSITION_LABELS, DEPARTMENT_LABELS, DEPARTMENT_COLORS,
  STAFF_STATUS_LABELS, STAFF_STATUS_COLORS, ENGAGEMENT_LABELS, formatDate,
} from "@/lib/formatting/display-maps";
import { FOH_POSITIONS, BOH_POSITIONS } from "@/lib/staff/positions";
import { TimSkeleton } from "./venue-helpers";
import type { Venue, StaffMember, StaffResponse } from "./venue-types";

type Dept = "FOH" | "BOH";

const EMPLOYMENT_TYPES = ["FULL_TIME", "SEASONAL", "WEEKEND", "CELEBRATION"] as const;

/** Today as yyyy-mm-dd, for the date input default. */
const todayISO = () => new Date().toISOString().slice(0, 10);

/* ── Add-staff modal ─────────────────────────────────────────────────────── */

type AddForm = {
  waiterId:       string;
  waiterName:     string;
  position:       string;
  employmentType: string;
  startedAt:      string;
};

function AddStaffModal({ venueId, hasKitchen, onClose, onSaved }: {
  venueId: string;
  hasKitchen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [search, setSearch] = useState("");
  // One grouped object rather than a useState per field — keeps the form from
  // desyncing and makes validation a single read.
  const [form, setForm] = useState<AddForm>({
    waiterId: "", waiterName: "", position: "WAITER",
    employmentType: "FULL_TIME", startedAt: todayISO(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const setField = <K extends keyof AddForm>(k: K, v: AddForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const { waiters, isLoading } = useWaiterSearch<{
    id: string; name: string | null; image: string | null; verificationTier: string;
    waiterPassport: { score: number } | null;
  }>({ search }, { enabled: true });

  const positions = hasKitchen ? [...FOH_POSITIONS, ...BOH_POSITIONS] : FOH_POSITIONS;

  const submit = async () => {
    if (!form.waiterId) { setError("Izaberite radnika"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/venues/${venueId}/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waiterId:       form.waiterId,
          position:       form.position,
          employmentType: form.employmentType,
          startedAt:      form.startedAt,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Greška pri dodavanju");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
         onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[88dvh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-lg text-neutral-900">Dodaj radnika</h3>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 text-xl leading-none">×</button>
          </div>

          {/* Step 1 — pick the person */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Radnik</label>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pretraži po imenu…"
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-orange-400"
            />
            <div className="max-h-52 overflow-y-auto flex flex-col gap-1 border border-neutral-100 rounded-xl p-1">
              {isLoading && <p className="text-xs text-neutral-400 p-2">Učitavanje…</p>}
              {!isLoading && waiters.length === 0 && (
                <p className="text-xs text-neutral-400 p-2">Nema rezultata</p>
              )}
              {waiters.map(w => (
                <button
                  key={w.id}
                  onClick={() => setForm(f => ({ ...f, waiterId: w.id, waiterName: w.name ?? "Radnik" }))}
                  className={`flex items-center gap-2 p-2 rounded-lg text-left transition ${
                    form.waiterId === w.id ? "bg-orange-50 ring-1 ring-orange-300" : "hover:bg-neutral-50"
                  }`}>
                  {w.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={w.image} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    : <Initials name={w.name} />}
                  <span className="text-sm font-bold text-neutral-900 flex-1 truncate">{w.name ?? "Radnik"}</span>
                  <VerifiedBadge tier={w.verificationTier} />
                  {w.waiterPassport && <ScorePill score={w.waiterPassport.score} />}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2 — the terms */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Pozicija</span>
              <select
                value={form.position}
                onChange={e => setField("position", e.target.value)}
                className="px-3 py-2 rounded-xl border border-neutral-200 text-sm bg-white">
                {positions.map(p => (
                  <option key={p} value={p}>{POSITION_LABELS[p]}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Angažman</span>
              <select
                value={form.employmentType}
                onChange={e => setField("employmentType", e.target.value)}
                className="px-3 py-2 rounded-xl border border-neutral-200 text-sm bg-white">
                {EMPLOYMENT_TYPES.map(t => (
                  <option key={t} value={t}>{ENGAGEMENT_LABELS[t]}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Datum početka</span>
              <input
                type="date"
                value={form.startedAt}
                onChange={e => setField("startedAt", e.target.value)}
                className="px-3 py-2 rounded-xl border border-neutral-200 text-sm"
              />
            </label>
          </div>

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-bold text-neutral-600 hover:bg-neutral-50">
              Otkaži
            </button>
            <button onClick={submit} disabled={saving || !form.waiterId}
              className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-50">
              {saving ? "Čuvanje…" : "Dodaj"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Edit-staff modal ────────────────────────────────────────────────────── */

function EditStaffModal({ venueId, member, hasKitchen, onClose, onSaved }: {
  venueId: string;
  member: StaffMember;
  hasKitchen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    position:       member.position,
    employmentType: member.employmentType,
    status:         member.status as string,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const setField = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const positions = hasKitchen ? [...FOH_POSITIONS, ...BOH_POSITIONS] : FOH_POSITIONS;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/venues/${venueId}/staff/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Greška pri čuvanju");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
         onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl"
           onClick={e => e.stopPropagation()}>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-lg text-neutral-900">{member.waiter.name ?? "Radnik"}</h3>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 text-xl leading-none">×</button>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Pozicija</span>
            <select value={form.position} onChange={e => setField("position", e.target.value)}
              className="px-3 py-2 rounded-xl border border-neutral-200 text-sm bg-white">
              {positions.map(p => <option key={p} value={p}>{POSITION_LABELS[p]}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Angažman</span>
            <select value={form.employmentType} onChange={e => setField("employmentType", e.target.value)}
              className="px-3 py-2 rounded-xl border border-neutral-200 text-sm bg-white">
              {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{ENGAGEMENT_LABELS[t]}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Status</span>
            <select value={form.status} onChange={e => setField("status", e.target.value)}
              className="px-3 py-2 rounded-xl border border-neutral-200 text-sm bg-white">
              {(["ACTIVE", "SUSPENDED", "ENDED"] as const).map(s => (
                <option key={s} value={s}>{STAFF_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </label>

          {form.status === "ENDED" && (
            <p className="text-xs text-neutral-500 bg-neutral-50 rounded-lg p-2">
              Radnik ostaje u istoriji, ali se više ne pojavljuje u rasporedu.
              Ako je bio šef sale ili šef kuhinje, gubi prava upravljanja.
            </p>
          )}

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-bold text-neutral-600 hover:bg-neutral-50">
              Otkaži
            </button>
            <button onClick={submit} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-50">
              {saving ? "Čuvanje…" : "Sačuvaj"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Roster row ──────────────────────────────────────────────────────────── */

function StaffRow({ member, canManage, onEdit }: {
  member: StaffMember;
  canManage: boolean;
  onEdit: () => void;
}) {
  const p = member.waiter.waiterPassport;

  return (
    <div className="dash-card p-4 flex items-center gap-3">
      {member.waiter.image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={member.waiter.image} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
        : <Initials name={member.waiter.name} />}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-black text-sm text-neutral-900 truncate">{member.waiter.name ?? "Radnik"}</p>
          <VerifiedBadge tier={member.waiter.verificationTier} />
          {p && <ScorePill score={p.score} />}
        </div>
        <p className="text-xs text-neutral-500 mt-0.5">
          {POSITION_LABELS[member.position] ?? member.position}
          {" · "}{ENGAGEMENT_LABELS[member.employmentType] ?? member.employmentType}
          {" · od "}{formatDate(member.startedAt)}
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {member.status !== "ACTIVE" && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STAFF_STATUS_COLORS[member.status]}`}>
            {STAFF_STATUS_LABELS[member.status]}
          </span>
        )}
        {canManage && (
          <button onClick={onEdit}
            className="text-xs font-bold px-3 py-1.5 rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50">
            Uredi
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Section ─────────────────────────────────────────────────────────────── */

export default function VenueTimSection({ venue }: { venue: Venue | null }) {
  const [dept, setDept]       = useState<Dept | "ALL">("ALL");
  const [adding, setAdding]   = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);

  const { data, isLoading, mutate } = useApi<StaffResponse>(
    venue ? `/api/venues/${venue.id}/staff?includeEnded=true` : "",
    { enabled: !!venue },
  );

  if (!venue) {
    return <p className="text-sm text-neutral-500">Prvo kreirajte lokal u sekciji Profil.</p>;
  }
  if (isLoading) return <TimSkeleton />;

  const hasKitchen = data?.hasKitchen ?? false;
  const canManage  = data?.canManage ?? false;
  const all        = data?.staff ?? [];
  const shown      = dept === "ALL" ? all : all.filter(m => m.department === dept);

  const activeCount = (d: Dept) =>
    all.filter(m => m.department === d && m.status === "ACTIVE").length;

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-neutral-900">Osoblje</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {all.filter(m => m.status === "ACTIVE").length} aktivnih
            {hasKitchen && ` · ${activeCount("FOH")} u sali, ${activeCount("BOH")} u kuhinji`}
          </p>
        </div>
        {canManage && (
          <button onClick={() => setAdding(true)}
            className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600">
            + Dodaj radnika
          </button>
        )}
      </div>

      {/* Department tabs exist only where a kitchen exists — a kafić should not
          see a Kuhinja filter that can never match anything. */}
      {hasKitchen && (
        <div className="flex gap-2">
          {(["ALL", "FOH", "BOH"] as const).map(d => (
            <button key={d} onClick={() => setDept(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                dept === d
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white text-neutral-600 border-neutral-200 hover:border-orange-300"
              }`}>
              {d === "ALL" ? "Svi" : DEPARTMENT_LABELS[d]}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="dash-card p-8 text-center">
          <p className="text-sm font-bold text-neutral-900">Još nema osoblja</p>
          <p className="text-xs text-neutral-500 mt-1">
            Dodajte radnike da biste mogli da pravite raspored i, uskoro, vodite odmore.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map(m => (
            <div key={m.id} className="relative">
              {dept === "ALL" && hasKitchen && (
                <span className={`absolute -top-1 left-3 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${DEPARTMENT_COLORS[m.department]}`}>
                  {DEPARTMENT_LABELS[m.department]}
                </span>
              )}
              <StaffRow member={m} canManage={canManage} onEdit={() => setEditing(m)} />
            </div>
          ))}
        </div>
      )}

      {adding && (
        <AddStaffModal venueId={venue.id} hasKitchen={hasKitchen}
          onClose={() => setAdding(false)} onSaved={mutate} />
      )}
      {editing && (
        <EditStaffModal venueId={venue.id} member={editing} hasKitchen={hasKitchen}
          onClose={() => setEditing(null)} onSaved={mutate} />
      )}
    </>
  );
}
