interface StarRatingProps {
  rating: number;
  count?: number;
  size?: "xs" | "sm" | "md";
  className?: string;
}

const SIZE = {
  xs: 9,
  sm: 12,
  md: 16,
};

export function StarRating({ rating, count, size = "sm", className }: StarRatingProps) {
  const px = SIZE[size];
  const full = Math.floor(rating);
  const partial = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - partial;

  const Star = ({ fill }: { fill: string }) => (
    <svg width={px} height={px} viewBox="0 0 10 10" fill={fill}>
      <path d="M5 1L6.18 3.42L9 3.82L7 5.77L7.49 8.58L5 7.24L2.51 8.58L3 5.77L1 3.82L3.82 3.42L5 1Z" />
    </svg>
  );

  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <span className="flex items-center gap-0.5">
        {Array.from({ length: full }).map((_, i) => <Star key={`f${i}`} fill="#f97316" />)}
        {partial === 1 && <Star fill="#fdba74" />}
        {Array.from({ length: empty }).map((_, i) => <Star key={`e${i}`} fill="#d4d4d4" />)}
      </span>
      {count !== undefined && (
        <span className={`text-neutral-500 ${size === "xs" ? "text-[9px]" : "text-xs"}`}>
          · {count}
        </span>
      )}
    </span>
  );
}
