/**
 * Stars – renders a 5-star rating from a 0-100 score (the DB/API scale).
 * Conversion: Math.round(rating / 20) → 0-5 stars.
 */
export function Stars({ rating }: { rating: number }) {
  const n = Math.round(rating / 20);
  return (
    <span className="text-amber-400 text-sm">
      {"★".repeat(n)}{"☆".repeat(5 - n)}
    </span>
  );
}
