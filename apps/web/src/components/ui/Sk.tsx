/**
 * Shared skeleton loader block.
 *
 * Usage:
 *   <Sk className="h-8 w-40" />           ← light background (dash-card context)
 *   <Sk dark className="h-8 w-40" />      ← dark background (dark dashboard context)
 *
 * dark=false → bg-neutral-200 rounded-lg  (venue / waiter dashboards)
 * dark=true  → bg-white/10   rounded-xl  (admin dashboard)
 *
 * Do not redefine Sk locally in helper files — import from here.
 */
export function Sk({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  const base = dark ? "bg-white/10 rounded-xl" : "bg-neutral-200 rounded-lg";
  return <div className={`${base} animate-pulse ${className}`} />;
}
