import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface FeatureTile {
  Icon: LucideIcon;
  title: string;
  desc: string;
}

interface Props {
  id?: string;
  kicker: string;
  heading: ReactNode;
  sub?: string;
  tiles: FeatureTile[];
}

/**
 * Scannable "what the app does" grid. One tile = one feature, icon + title +
 * one line. Both landing pages pass their own tile set; the markup lives here
 * so the two feature overviews never drift (same pattern as WaiterCard).
 */
export function FeatureGrid({ id, kicker, heading, sub, tiles }: Props) {
  return (
    <section id={id} className="max-w-7xl mx-auto px-6 py-20">
      <div className="max-w-2xl mb-12">
        <span className="inline-block bg-orange-50 border border-orange-100 text-orange-500 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">
          {kicker}
        </span>
        <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">
          {heading}
        </h2>
        {sub && (
          <p className="mt-4 text-lg text-neutral-500 font-light leading-relaxed">{sub}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map(({ Icon, title, desc }) => (
          <div
            key={title}
            className="bg-white rounded-2xl p-5 border border-neutral-100 flex flex-col gap-3 hover:border-orange-200 transition-colors"
          >
            <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <Icon size={22} className="text-orange-500" strokeWidth={2} />
            </div>
            <h3 className="font-bold text-base text-neutral-900 leading-tight">{title}</h3>
            <p className="text-sm text-neutral-500 font-light leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
