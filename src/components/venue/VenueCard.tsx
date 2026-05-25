import Link from "next/link";
import { VENUE_TYPE_LABELS } from "@/lib/formatting/display-maps";

export interface VenueCardProps {
  id: string;
  name: string;
  venueType: string;
  address: string;
  municipality: string;
  trustScore: number;
  priceRangeMin?: number | null;
  priceRangeMax?: number | null;
  activeJobs?: number;
  zone?: { zoneType: string; projectedGrowthPercent: number } | null;
}

export default function VenueCard({
  id, name, venueType, address, municipality,
  trustScore, priceRangeMin, priceRangeMax, activeJobs, zone,
}: VenueCardProps) {
  const priceLabel = priceRangeMin || priceRangeMax
    ? priceRangeMin && priceRangeMax
      ? `${priceRangeMin.toLocaleString("sr-RS")}–${priceRangeMax.toLocaleString("sr-RS")} RSD/h`
      : priceRangeMin
        ? `od ${priceRangeMin.toLocaleString("sr-RS")} RSD/h`
        : `do ${priceRangeMax!.toLocaleString("sr-RS")} RSD/h`
    : null;

  const scoreColor =
    trustScore >= 80 ? "text-green-600 bg-green-50 border-green-200" :
    trustScore >= 60 ? "text-amber-600 bg-amber-50 border-amber-200" :
                       "text-neutral-500 bg-neutral-50 border-neutral-200";

  return (
    <Link href={`/venues/${id}`} className="block group">
      <div className="dash-card p-5 h-full flex flex-col gap-3 hover:border-orange-200 hover:shadow-md transition-all duration-150">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-0.5">
              {VENUE_TYPE_LABELS[venueType] ?? venueType}
            </p>
            <h3 className="font-black text-neutral-900 text-base leading-snug truncate group-hover:text-orange-600 transition-colors">
              {name}
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5 truncate">{address}, {municipality}</p>
          </div>
          {trustScore > 0 && (
            <span className={`flex-shrink-0 text-xs font-black px-2 py-0.5 rounded-full border ${scoreColor}`}>
              {Math.round(trustScore)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 mt-auto">
          {priceLabel && (
            <span className="text-xs font-semibold text-neutral-600 bg-neutral-50 border border-neutral-200 px-2 py-0.5 rounded-full">
              {priceLabel}
            </span>
          )}
          {activeJobs !== undefined && activeJobs > 0 && (
            <span className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
              {activeJobs} oglas{activeJobs === 1 ? "" : activeJobs < 5 ? "a" : "a"}
            </span>
          )}
          {zone && zone.projectedGrowthPercent > 0 && (
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              +{zone.projectedGrowthPercent}% rast
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
