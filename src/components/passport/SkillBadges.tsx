const SKILL_ICONS: Record<string, string> = {
  cocktail:      "🍹",
  "fine dining": "🍽️",
  sommelier:     "🍷",
  barista:       "☕",
  "kafe aparat": "☕",
  bartender:     "🍸",
  sushi:         "🍣",
  pizza:         "🍕",
  catering:      "🥂",
  delivery:      "📦",
};

export interface SkillBadgesProps {
  skills: string[];
  languages?: string[];
  size?: "sm" | "md";
}

export default function SkillBadges({ skills, languages, size = "md" }: SkillBadgesProps) {
  const base = size === "sm"
    ? "text-xs px-2 py-0.5 rounded-full font-semibold border"
    : "text-sm px-3 py-1 rounded-full font-semibold border";

  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <span
          key={skill}
          className={`${base} text-orange-700 bg-orange-50 border-orange-200`}
        >
          {SKILL_ICONS[skill.toLowerCase()] ?? "✦"} {skill}
        </span>
      ))}
      {languages?.map((lang) => (
        <span
          key={lang}
          className={`${base} text-blue-700 bg-blue-50 border-blue-200`}
        >
          🌐 {lang}
        </span>
      ))}
    </div>
  );
}
