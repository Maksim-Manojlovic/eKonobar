import Link from "next/link";
import { ENGAGEMENT_LABELS } from "@/lib/formatting/display-maps";

const TIP_LABELS: Record<string, string> = {
  INDIVIDUAL:   "Lični bakšiš",
  SHARED:       "Zajednički bakšiš",
  VENUE_POLICY: "Politika lokala",
};

export interface JobCardProps {
  id: string;
  title: string;
  engagementType: string;
  tipSystem: string;
  tipDescription?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  sanitaryRequired: boolean;
  redAlert: boolean;
  redAlertNote?: string | null;
  startDate?: string | null;
  venue: {
    id: string;
    name: string;
    municipality: string;
    venueType: string;
    trustScore?: number;
  };
  applicationCount?: number;
}

export default function JobCard({
  id, title, engagementType, tipSystem, tipDescription,
  salaryMin, salaryMax, sanitaryRequired, redAlert, redAlertNote,
  startDate, venue, applicationCount,
}: JobCardProps) {
  const salaryLabel = salaryMin || salaryMax
    ? salaryMin && salaryMax
      ? `${salaryMin.toLocaleString("sr-RS")}–${salaryMax.toLocaleString("sr-RS")} RSD`
      : salaryMin
        ? `od ${salaryMin.toLocaleString("sr-RS")} RSD`
        : `do ${salaryMax!.toLocaleString("sr-RS")} RSD`
    : "Po dogovoru";

  const dateLabel = startDate
    ? `od ${new Date(startDate).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short" })}`
    : null;

  return (
    <Link href={`/jobs/${id}`} className="block group">
      <div className={`dash-card p-5 h-full flex flex-col gap-3 transition-all duration-150 hover:shadow-md ${
        redAlert
          ? "border-red-200 hover:border-red-400"
          : "hover:border-orange-200"
      }`}>
        {/* Red Alert banner */}
        {redAlert && (
          <div className="flex items-center gap-2 -mx-5 -mt-5 px-5 py-2 bg-red-50 rounded-t-[19px] border-b border-red-100">
            <div className="relative w-3 h-3 flex-shrink-0">
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
              <span className="absolute inset-0 rounded-full bg-red-500" />
            </div>
            <span className="text-xs font-bold text-red-700">
              {redAlertNote ?? "Hitna smena"}
            </span>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-orange-500 uppercase tracking-wide">
              {ENGAGEMENT_LABELS[engagementType] ?? engagementType}
            </span>
          </div>
          <h3 className="font-black text-neutral-900 text-base leading-snug group-hover:text-orange-600 transition-colors">
            {title}
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">{venue.name} · {venue.municipality}</p>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-auto">
          <span className="text-xs font-semibold text-neutral-700 bg-neutral-50 border border-neutral-200 px-2 py-0.5 rounded-full">
            {salaryLabel}{engagementType !== "FULL_TIME" ? "/sm" : "/mes"}
          </span>
          <span className="text-xs font-medium text-neutral-500 bg-neutral-50 border border-neutral-200 px-2 py-0.5 rounded-full">
            💰 {tipDescription ? tipDescription.slice(0, 28) : TIP_LABELS[tipSystem]}
          </span>
          {sanitaryRequired && (
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
              📋 Sanitarna obavezna
            </span>
          )}
          {dateLabel && (
            <span className="text-xs font-medium text-neutral-400 bg-neutral-50 border border-neutral-200 px-2 py-0.5 rounded-full">
              {dateLabel}
            </span>
          )}
          {applicationCount !== undefined && (
            <span className="text-xs font-medium text-neutral-400 ml-auto">
              {applicationCount} prijav{applicationCount === 1 ? "a" : "e"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
