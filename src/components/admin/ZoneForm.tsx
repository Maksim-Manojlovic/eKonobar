"use client";

import { useState } from "react";
import type { Zone } from "./ZoneRow";

const ZONE_TYPES = [
  { value: "FESTIVAL_ZONE", label: "Festival zona" },
  { value: "TRANSIT_HUB",   label: "Čvorište prevoza" },
  { value: "DEVELOPMENT",   label: "Zona razvoja" },
  { value: "NIGHTLIFE",     label: "Noćni život" },
  { value: "TOURIST_AREA",  label: "Turistička zona" },
  { value: "STUDENT_AREA",  label: "Studentska zona" },
  { value: "RESIDENTIAL",   label: "Stambena zona" },
];

export interface ZoneFormData {
  name: string;
  zoneType: string;
  description?: string;
  centerLat: string;
  centerLng: string;
  radiusKm: string;
  projectedGrowthPercent: string;
  operatorTip?: string;
  geoJson?: string;
}

export interface ZoneFormProps {
  initialData?: Zone;
  onSubmit: (data: ZoneFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

const EMPTY: ZoneFormData = {
  name: "", zoneType: "FESTIVAL_ZONE", description: "",
  centerLat: "", centerLng: "", radiusKm: "1.0",
  projectedGrowthPercent: "0", operatorTip: "", geoJson: "{}",
};

export default function ZoneForm({ initialData, onSubmit, onCancel, loading }: ZoneFormProps) {
  const [form, setForm] = useState<ZoneFormData>(
    initialData
      ? {
          name: initialData.name,
          zoneType: initialData.zoneType,
          centerLat: String(initialData.centerLat),
          centerLng: String(initialData.centerLng),
          radiusKm: String(initialData.radiusKm),
          projectedGrowthPercent: String(initialData.projectedGrowthPercent),
          operatorTip: initialData.operatorTip ?? "",
          geoJson: "{}",
        }
      : EMPTY,
  );
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof ZoneFormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.zoneType || !form.centerLat || !form.centerLng) {
      setError("Ime, tip, lat i lng su obavezni.");
      return;
    }
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Greška");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">Naziv *</label>
          <input value={form.name} onChange={e => set("name", e.target.value)} className="auth-input" placeholder="npr. Sajam Beograd" required />
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">Tip zone *</label>
          <select value={form.zoneType} onChange={e => set("zoneType", e.target.value)} className="auth-input bg-white">
            {ZONE_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">Projekcija rasta (%)</label>
          <input value={form.projectedGrowthPercent} onChange={e => set("projectedGrowthPercent", e.target.value)} type="number" min="0" max="200" className="auth-input" placeholder="0" />
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">Centar — Lat *</label>
          <input value={form.centerLat} onChange={e => set("centerLat", e.target.value)} type="number" step="any" className="auth-input" placeholder="44.8178" required />
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">Centar — Lng *</label>
          <input value={form.centerLng} onChange={e => set("centerLng", e.target.value)} type="number" step="any" className="auth-input" placeholder="20.4569" required />
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">Radijus (km)</label>
          <input value={form.radiusKm} onChange={e => set("radiusKm", e.target.value)} type="number" step="0.1" min="0.1" className="auth-input" placeholder="1.0" />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">Savet za vlasnike lokala</label>
          <input value={form.operatorTip} onChange={e => set("operatorTip", e.target.value)} className="auth-input" placeholder="Visoka sezonska potražnja — predlažemo vikend smene..." />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn-dash-outline flex-1 py-2.5">Otkaži</button>
        <button type="submit" disabled={loading} className="btn-dash-orange flex-1 py-2.5 disabled:opacity-50">
          {loading ? "Čuvam..." : initialData ? "Sačuvaj izmene" : "Kreiraj zonu"}
        </button>
      </div>
    </form>
  );
}
