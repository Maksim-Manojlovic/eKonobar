import SkillBadges from "./SkillBadges";

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  ID_VERIFIED: { label: "ID Verifikovan",  color: "bg-purple-100 text-purple-700 border-purple-300" },
  GOLD:        { label: "Gold",            color: "bg-amber-100  text-amber-700  border-amber-300"  },
  SILVER:      { label: "Silver",          color: "bg-slate-100  text-slate-600  border-slate-300"  },
  UNVERIFIED:  { label: "Neverifikovan",   color: "bg-neutral-100 text-neutral-500 border-neutral-300" },
};

export interface PassportCardProps {
  name?: string | null;
  image?: string | null;
  score: number;
  verificationTier: string;
  yearsExperience: number;
  totalEngagements: number;
  reviewCount: number;
  sanitaryBookValid: boolean;
  currentlyAvailable: boolean;
  skills: string[];
  languages: string[];
  bio?: string | null;
  badges?: string[];
}

function ScoreCircle({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r="40" fill="none" stroke="#f0efec" strokeWidth="8" />
        <circle cx="48" cy="48" r="40" fill="none" stroke="#f97316" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-neutral-900">{Math.round(score)}</span>
        <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wide">skor</span>
      </div>
    </div>
  );
}

function Initials({ name }: { name?: string | null }) {
  const letters = name
    ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  return (
    <div className="w-16 h-16 rounded-full bg-orange-100 text-orange-600 font-black text-xl flex items-center justify-center border-2 border-orange-200">
      {letters}
    </div>
  );
}

export default function PassportCard({
  name, image, score, verificationTier, yearsExperience,
  totalEngagements, reviewCount, sanitaryBookValid, currentlyAvailable,
  skills, languages, bio, badges,
}: PassportCardProps) {
  const tier = TIER_LABELS[verificationTier] ?? TIER_LABELS.UNVERIFIED;

  return (
    <div className="dash-card p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex gap-5 items-start">
        <div className="flex flex-col items-center gap-2">
          {image
            ? <img src={image} alt={name ?? ""} className="w-16 h-16 rounded-full object-cover border-2 border-orange-200" />
            : <Initials name={name} />
          }
          <ScoreCircle score={score} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1">
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${tier.color}`}>
              {tier.label}
            </span>
            {currentlyAvailable && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block pulse-dot" />
                Dostupan
              </span>
            )}
            {sanitaryBookValid && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                📋 Sanitarna
              </span>
            )}
          </div>

          <h2 className="text-xl font-black text-neutral-900">{name ?? "Konobar"}</h2>
          <p className="text-sm text-neutral-500">Konobar · Beograd</p>

          <div className="flex gap-5 mt-3">
            {[
              { label: "Angažmana", value: totalEngagements },
              { label: "Recenzija",  value: reviewCount },
              { label: "God. iskustva", value: yearsExperience },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-lg font-black text-neutral-900">{value}</div>
                <div className="text-[11px] text-neutral-400 font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bio */}
      {bio && (
        <p className="text-sm text-neutral-600 leading-relaxed border-t border-neutral-100 pt-4">
          {bio}
        </p>
      )}

      {/* Skills + languages */}
      {(skills.length > 0 || (languages?.length ?? 0) > 0) && (
        <div className="border-t border-neutral-100 pt-4">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Veštine</p>
          <SkillBadges skills={skills} languages={languages} size="sm" />
        </div>
      )}
    </div>
  );
}
