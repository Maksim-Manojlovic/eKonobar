"use client";

import { useState } from "react";

const ZONE_TYPE_LABELS: Record<string, string> = {
  FESTIVAL_ZONE: "Festival",
  TRANSIT_HUB:   "Čvorište",
  DEVELOPMENT:   "Razvoj",
  NIGHTLIFE:     "Noćni život",
  TOURIST_AREA:  "Turizam",
  STUDENT_AREA:  "Studentska",
  RESIDENTIAL:   "Stambena",
};

const ZONE_TYPE_COLORS: Record<string, string> = {
  FESTIVAL_ZONE: "text-purple-700 bg-purple-50 border-purple-300",
  TRANSIT_HUB:   "text-blue-700   bg-blue-50   border-blue-300",
  DEVELOPMENT:   "text-emerald-700 bg-emerald-50 border-emerald-300",
  NIGHTLIFE:     "text-indigo-700 bg-indigo-50  border-indigo-300",
  TOURIST_AREA:  "text-amber-700  bg-amber-50   border-amber-300",
  STUDENT_AREA:  "text-cyan-700   bg-cyan-50    border-cyan-300",
  RESIDENTIAL:   "text-neutral-600 bg-neutral-50 border-neutral-300",
};

export interface Zone {
  id: string;
  name: string;
  zoneType: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  projectedGrowthPercent: number;
  operatorTip?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ZoneRowProps {
  zone: Zone;
  onEdit: (zone: Zone) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  deleting: boolean;
}

export default function ZoneRow({ zone, onEdit, onDelete, onToggleActive, deleting }: ZoneRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <tr className="border-t border-neutral-100 hover:bg-neutral-50 transition-colors">
      <td className="px-4 py-3">
        <div>
          <p className="font-bold text-neutral-900 text-sm">{zone.name}</p>
          {zone.operatorTip && (
            <p className="text-xs text-neutral-400 mt-0.5 truncate max-w-xs">{zone.operatorTip}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ZONE_TYPE_COLORS[zone.zoneType] ?? "text-neutral-600 bg-neutral-50 border-neutral-300"}`}>
          {ZONE_TYPE_LABELS[zone.zoneType] ?? zone.zoneType}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-neutral-600">
        {zone.projectedGrowthPercent > 0 ? `+${zone.projectedGrowthPercent}%` : "—"}
      </td>
      <td className="px-4 py-3 text-xs text-neutral-400">
        {zone.centerLat.toFixed(4)}, {zone.centerLng.toFixed(4)} · {zone.radiusKm}km
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onToggleActive(zone.id, !zone.isActive)}
          className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-all ${
            zone.isActive
              ? "text-green-700 bg-green-50 border-green-300 hover:bg-green-100"
              : "text-neutral-500 bg-neutral-50 border-neutral-300 hover:bg-neutral-100"
          }`}
        >
          {zone.isActive ? "Aktivna" : "Neaktivna"}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(zone)}
            className="btn-dash-outline px-3 py-1 text-xs"
          >
            Uredi
          </button>
          {confirmDelete ? (
            <div className="flex gap-1">
              <button
                onClick={() => onDelete(zone.id)}
                disabled={deleting}
                className="text-xs font-bold px-2.5 py-1 rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-all"
              >
                {deleting ? "..." : "Potvrdi"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs font-bold px-2.5 py-1 rounded-xl bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-all"
              >
                Otkaži
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs font-bold px-2.5 py-1 rounded-xl text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-all"
            >
              Obriši
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
