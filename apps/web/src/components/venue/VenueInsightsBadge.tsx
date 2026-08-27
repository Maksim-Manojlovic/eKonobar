"use client";

import type { VenueZoneInsights } from "@/lib/geo/analytics";

const ZONE_LABELS: Record<string, string> = {
  FESTIVAL_ZONE: "Festival zona",
  TRANSIT_HUB:   "Tranzitni čvor",
  DEVELOPMENT:   "Razvojna zona",
  RESIDENTIAL:   "Stambena zona",
  COMMERCIAL:    "Komercijalna zona",
};

const INVESTMENT_TYPES = new Set(["FESTIVAL_ZONE", "TRANSIT_HUB", "DEVELOPMENT"]);

interface Props {
  insights: VenueZoneInsights | null;
  compact?: boolean;
}

export default function VenueInsightsBadge({ insights, compact = false }: Props) {
  if (!insights || !insights.hasZoneBadge) return null;

  const investmentZones = insights.insights.filter(z => INVESTMENT_TYPES.has(z.type));
  if (investmentZones.length === 0) return null;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
        📈 {insights.totalProjectedGrowth > 0 ? `+${insights.totalProjectedGrowth}% rast` : "Investiciona zona"}
      </span>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-black text-emerald-800 uppercase tracking-wide">
          📈 Investiciona zona
        </span>
        {insights.totalProjectedGrowth > 0 && (
          <span className="text-xs font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
            +{insights.totalProjectedGrowth}% proj. rast
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2.5">
        {investmentZones.map(z => (
          <div key={z.zoneId} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-emerald-900">{z.name}</span>
              <span className="text-[10px] text-emerald-600 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                {ZONE_LABELS[z.type] ?? z.type}
              </span>
              {z.projectedGrowthPercent > 0 && (
                <span className="text-[10px] font-black text-emerald-700 ml-auto">
                  +{z.projectedGrowthPercent}%
                </span>
              )}
            </div>
            {z.operatorTip && (
              <p className="text-[11px] text-emerald-700 leading-relaxed">{z.operatorTip}</p>
            )}
            <p className="text-[10px] text-emerald-500">
              {z.distanceKm < 0.1 ? "Unutar zone" : `${z.distanceKm} km od centra`}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-emerald-500 border-t border-emerald-200 pt-2">
        Podaci se ažuriraju svakih 24h na osnovu gradskih zona razvoja.
      </p>
    </div>
  );
}
