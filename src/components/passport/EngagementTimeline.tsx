import { ENGAGEMENT_LABELS } from "@/lib/formatting/display-maps";

const VENUE_TYPE_ICONS: Record<string, string> = {
  RESTAURANT: "🍽️",
  CAFE:       "☕",
  BAR:        "🍸",
  CATERING:   "🥂",
  HOTEL:      "🏨",
  EVENT:      "🎉",
};

export interface EngagementRecord {
  id: string;
  engagementType: string;
  startDate: string;
  endDate?: string | null;
  verified: boolean;
  verifiedAt?: string | null;
  venue: {
    id: string;
    name: string;
    municipality: string;
    venueType: string;
  };
}

function formatPeriod(start: string, end?: string | null): string {
  const s = new Date(start);
  const sLabel = s.toLocaleDateString("sr-Latn-RS", { month: "short", year: "numeric" });
  if (!end) return `${sLabel} — danas`;
  const e = new Date(end);
  const eLabel = e.toLocaleDateString("sr-Latn-RS", { month: "short", year: "numeric" });
  return `${sLabel} — ${eLabel}`;
}

export interface EngagementTimelineProps {
  records: EngagementRecord[];
  compact?: boolean;
}

export default function EngagementTimeline({ records, compact = false }: EngagementTimelineProps) {
  if (records.length === 0) {
    return (
      <p className="text-sm text-neutral-400 text-center py-8">
        Nema evidentiranih angažmana.
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-2 bottom-2 w-px bg-neutral-100" />

      <div className="space-y-4">
        {records.map((rec) => (
          <div key={rec.id} className="relative flex gap-4 pl-10">
            {/* Dot */}
            <div className={`absolute left-2.5 top-3 w-3 h-3 rounded-full border-2 flex-shrink-0 ${
              rec.verified
                ? "bg-green-500 border-green-400"
                : "bg-neutral-200 border-neutral-300"
            }`} style={{ transform: "translateX(-50%)" }} />

            <div className={`dash-card p-4 flex-1 ${compact ? "" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">
                      {VENUE_TYPE_ICONS[rec.venue.venueType] ?? "🏢"}
                    </span>
                    <p className="font-bold text-neutral-900 text-sm truncate">{rec.venue.name}</p>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">{rec.venue.municipality}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                    {ENGAGEMENT_LABELS[rec.engagementType] ?? rec.engagementType}
                  </span>
                  {rec.verified && (
                    <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                      ✓ Verifikovano
                    </span>
                  )}
                </div>
              </div>
              {!compact && (
                <p className="text-xs text-neutral-400 mt-2">
                  {formatPeriod(rec.startDate, rec.endDate)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
