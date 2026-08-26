"use client";

import { useState, useEffect } from "react";
import ZoneRow, { type Zone } from "@/components/admin/ZoneRow";
import ZoneForm, { type ZoneFormData } from "@/components/admin/ZoneForm";
import { useRequireRole } from "@/hooks/useRequireRole";

export default function AdminZonesPage() {
  const { status } = useRequireRole("ADMIN");

  const [zones, setZones]       = useState<Zone[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editZone, setEditZone] = useState<Zone | null>(null);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/admin/zones")
      .then((r) => r.json())
      .then((d) => setZones(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [status]);

  async function handleCreate(data: ZoneFormData) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          zoneType: data.zoneType,
          geoJson: data.geoJson ? JSON.parse(data.geoJson) : {},
          centerLat: Number(data.centerLat),
          centerLng: Number(data.centerLng),
          radiusKm: Number(data.radiusKm),
          projectedGrowthPercent: Number(data.projectedGrowthPercent),
          operatorTip: data.operatorTip || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Greška");
      const zone: Zone = await res.json();
      setZones((z) => [zone, ...z]);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Greška");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(data: ZoneFormData) {
    if (!editZone) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/zones/${editZone.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          zoneType: data.zoneType,
          centerLat: Number(data.centerLat),
          centerLng: Number(data.centerLng),
          radiusKm: Number(data.radiusKm),
          projectedGrowthPercent: Number(data.projectedGrowthPercent),
          operatorTip: data.operatorTip || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Greška");
      const updated: Zone = await res.json();
      setZones((z) => z.map((x) => (x.id === updated.id ? updated : x)));
      setEditZone(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Greška");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/zones/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Greška");
      setZones((z) => z.filter((x) => x.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Greška pri brisanju");
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    const res = await fetch(`/api/admin/zones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    if (res.ok) {
      const updated: Zone = await res.json();
      setZones((z) => z.map((x) => (x.id === updated.id ? updated : x)));
    }
  }

  if (status === "loading" || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafaf8" }}>
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  const activeCount = zones.filter(z => z.isActive).length;

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest">Admin</p>
            <h1 className="text-2xl font-black text-neutral-900">Zone na mapi</h1>
            <p className="text-sm text-neutral-500">{activeCount} aktivnih od {zones.length} ukupno</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditZone(null); }}
            className="btn-dash-orange px-5 py-2.5 text-sm"
          >
            + Nova zona
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>
        )}

        {/* Create / Edit form */}
        {(showForm || editZone) && (
          <div className="dash-card p-6">
            <h2 className="font-black text-neutral-900 mb-4">
              {editZone ? `Uredi: ${editZone.name}` : "Nova zona"}
            </h2>
            <ZoneForm
              initialData={editZone ?? undefined}
              onSubmit={editZone ? handleEdit : handleCreate}
              onCancel={() => { setShowForm(false); setEditZone(null); }}
              loading={saving}
            />
          </div>
        )}

        {/* Table */}
        {zones.length === 0 ? (
          <div className="dash-card p-14 text-center">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="font-bold text-neutral-900">Nema zona. Dodaj prvu zonu.</p>
          </div>
        ) : (
          <div className="dash-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-100">
                    {["Naziv", "Tip", "Rast", "Koordinate", "Status", "Akcije"].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {zones.map((zone) => (
                    <ZoneRow
                      key={zone.id}
                      zone={zone}
                      onEdit={(z) => { setEditZone(z); setShowForm(false); }}
                      onDelete={handleDelete}
                      onToggleActive={handleToggleActive}
                      deleting={deleting === zone.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
