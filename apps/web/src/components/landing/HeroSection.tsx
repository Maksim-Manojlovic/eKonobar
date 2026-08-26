import Link from "next/link";
import { MapPreview } from "@/components/landing/MapPreview";

const features = [
  { label: "Waiter Passport™", pulse: false },
  { label: "Red Alert™ Poslovi", pulse: true },
  { label: "Geofencing recenzije", pulse: false },
];

const avatarColors = ["bg-orange-200", "bg-orange-300", "bg-orange-400", "bg-orange-100"];

export function HeroSection() {
  return (
    <section className="max-w-7xl mx-auto px-6 pt-10 pb-24">
      <div className="grid lg:grid-cols-2 gap-14 items-center">

        {/* ── Left column ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-7">

          {/* Trust badge */}
          <div className="inline-flex items-center gap-2.5 bg-orange-50 border border-orange-100 rounded-full px-4 py-2 self-start">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L8.63 4.28L12.5 4.85L9.75 7.53L10.39 11.39L7 9.66L3.61 11.39L4.25 7.53L1.5 4.85L5.37 4.28L7 1Z" fill="#f97316" />
            </svg>
            <span className="text-sm font-semibold text-orange-600">Verified by 500+ Belgrade Venues</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl xl:text-6xl font-extrabold text-neutral-900 leading-[1.08] tracking-tight">
            Pronađi savršen<br />angažman.
            <span className="relative inline-block">
              <span className="text-orange-500"> Odmah.</span>
              <svg className="absolute -bottom-1 left-0 w-full" height="7" viewBox="0 0 110 7" fill="none" preserveAspectRatio="none">
                <path d="M2 5.5C22 2 44 5.5 55 3.5C66 1.5 88 5.5 108 3.5" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
              </svg>
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg text-neutral-500 font-light leading-relaxed max-w-lg">
            Prva platforma sa <strong className="font-semibold text-neutral-700">Waiter Passport™</strong> sistemom i geofencing recenzijama. Povežite se sa najboljim lokalima u Beogradu.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {features.map(({ label, pulse }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 text-orange-600 text-xs font-semibold px-3 py-1.5 rounded-full"
              >
                {pulse && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-blink" />}
                {label}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4 pt-1">
            <Link href="/jobs" className="btn-primary text-white font-bold text-base px-8 py-4 rounded-2xl flex items-center gap-2.5">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="8" cy="8" r="5.5" stroke="white" strokeWidth="2" />
                <path d="M12.5 12.5L16 16" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Traži posao
            </Link>
            <Link href="/register" className="btn-secondary font-semibold text-base px-8 py-4 rounded-2xl flex items-center gap-2.5">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="3" width="14" height="12" rx="2.5" stroke="currentColor" strokeWidth="2" />
                <path d="M9 7V11M7 9H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Postavi oglas
              <span className="text-xs font-normal text-neutral-400 hidden sm:inline">za vlasnike</span>
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-5 pt-1">
            <div className="flex -space-x-2">
              {avatarColors.map((c, i) => (
                <div key={i} className={`w-8 h-8 rounded-full ${c} border-2 border-white flex items-center justify-center`}>
                  {i === 3 && <span className="text-[10px] font-bold text-orange-400">+</span>}
                </div>
              ))}
            </div>
            <div>
              <div className="text-xs text-neutral-500">
                <span className="font-bold text-neutral-800">2,400+</span> konobara pronašlo posao ovaj mesec
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} width="9" height="9" viewBox="0 0 10 10" fill="#f97316">
                    <path d="M5 1L6.18 3.42L9 3.82L7 5.77L7.49 8.58L5 7.24L2.51 8.58L3 5.77L1 3.82L3.82 3.42L5 1Z" />
                  </svg>
                ))}
                <span className="text-xs text-neutral-400 ml-1.5">4.9 prosečna ocena</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column: map ─────────────────────────────────────────── */}
        <MapPreview />

      </div>
    </section>
  );
}
