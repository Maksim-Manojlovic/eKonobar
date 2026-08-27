import { StarRating } from "@/components/ui/StarRating";

const PinIcon = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
    <path d="M6 2C4.34 2 3 3.34 3 5C3 7.5 6 11 6 11C6 11 9 7.5 9 5C9 3.34 7.66 2 6 2Z" fill="white" />
  </svg>
);

interface MarkerProps {
  left: string;
  top: string;
  pulse?: boolean;
  delay?: string;
  size?: "sm" | "md";
  label?: string;
  labelColor?: string;
}

function MapMarker({ left, top, pulse = false, delay = "0s", size = "md", label, labelColor = "bg-orange-500" }: MarkerProps) {
  const dim = size === "md" ? "w-7 h-7" : "w-6 h-6";

  return (
    <div className="map-marker absolute" style={{ left, top }}>
      {label && (
        <div
          className={`absolute -top-7 left-1/2 -translate-x-1/2 ${labelColor} text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap`}
        >
          {label}
        </div>
      )}
      <div className={`relative ${dim}`}>
        {pulse && (
          <>
            <div className="pulse-ring-2" style={{ animationDelay: delay }} />
            <div className="pulse-ring" style={{ animationDelay: delay }} />
          </>
        )}
        <div
          className={`relative ${dim} rounded-full bg-orange-500 border-2 border-white shadow-lg z-10 flex items-center justify-center`}
        >
          <PinIcon />
        </div>
      </div>
    </div>
  );
}

export function MapPreview() {
  return (
    <div className="relative">
      {/* Map container */}
      <div
        className="w-full overflow-hidden relative"
        style={{
          background: "#f5f4f0",
          borderRadius: "2rem",
          aspectRatio: "4 / 3.2",
          boxShadow:
            "0 2px 4px rgba(0,0,0,0.03), 0 12px 40px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)",
        }}
      >
        {/* SVG city map */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 480" xmlns="http://www.w3.org/2000/svg">
          <rect width="600" height="480" fill="#f2f0eb" />
          {/* City blocks */}
          <rect x="20"  y="20"  width="120" height="80"  rx="6" fill="#e8e6e0" />
          <rect x="160" y="20"  width="80"  height="55"  rx="6" fill="#dddbd4" />
          <rect x="260" y="20"  width="100" height="70"  rx="6" fill="#e8e6e0" />
          <rect x="380" y="20"  width="80"  height="90"  rx="6" fill="#dddbd4" />
          <rect x="480" y="20"  width="100" height="60"  rx="6" fill="#e8e6e0" />
          <rect x="20"  y="150" width="80"  height="100" rx="6" fill="#e8e6e0" />
          <rect x="120" y="140" width="120" height="70"  rx="6" fill="#e2e0d9" />
          <rect x="260" y="130" width="90"  height="80"  rx="6" fill="#dddbd4" />
          <rect x="370" y="130" width="100" height="100" rx="6" fill="#e8e6e0" />
          <rect x="490" y="130" width="90"  height="70"  rx="6" fill="#dddbd4" />
          <rect x="20"  y="290" width="110" height="80"  rx="6" fill="#dddbd4" />
          <rect x="150" y="270" width="90"  height="110" rx="6" fill="#e8e6e0" />
          <rect x="260" y="280" width="100" height="90"  rx="6" fill="#e2e0d9" />
          <rect x="380" y="270" width="110" height="100" rx="6" fill="#dddbd4" />
          <rect x="510" y="280" width="70"  height="80"  rx="6" fill="#e8e6e0" />
          <rect x="20"  y="400" width="140" height="65"  rx="6" fill="#e8e6e0" />
          <rect x="180" y="400" width="80"  height="65"  rx="6" fill="#dddbd4" />
          <rect x="280" y="400" width="120" height="65"  rx="6" fill="#e2e0d9" />
          <rect x="420" y="400" width="160" height="65"  rx="6" fill="#e8e6e0" />
          {/* Roads */}
          <line x1="0" y1="120" x2="600" y2="120" stroke="#d6d3cc" strokeWidth="5" />
          <line x1="0" y1="245" x2="600" y2="245" stroke="#d6d3cc" strokeWidth="5" />
          <line x1="0" y1="375" x2="600" y2="375" stroke="#d6d3cc" strokeWidth="5" />
          <line x1="155" y1="0" x2="155" y2="480" stroke="#d6d3cc" strokeWidth="5" />
          <line x1="355" y1="0" x2="355" y2="480" stroke="#d6d3cc" strokeWidth="5" />
          <line x1="480" y1="0" x2="480" y2="480" stroke="#d6d3cc" strokeWidth="5" />
          <line x1="0" y1="180" x2="600" y2="180" stroke="#dddbd4" strokeWidth="3" />
          <line x1="245" y1="0" x2="245" y2="480" stroke="#dddbd4" strokeWidth="3" />
          <line x1="100" y1="0" x2="100" y2="480" stroke="#dddbd4" strokeWidth="3" />
          {/* Location labels */}
          <rect x="28"  y="192" width="64" height="18" rx="9" fill="white" opacity="0.85" />
          <text x="60"  y="205" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="8" fill="#78716c" fontWeight="500">Kalemegdan</text>
          <rect x="157" y="300" width="54" height="18" rx="9" fill="white" opacity="0.85" />
          <text x="184" y="313" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="8" fill="#78716c" fontWeight="500">Skadarlija</text>
          <rect x="263" y="416" width="56" height="18" rx="9" fill="white" opacity="0.85" />
          <text x="291" y="429" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="8" fill="#78716c" fontWeight="500">Savamala</text>
          {/* Compass */}
          <g transform="translate(555,48)">
            <circle r="15" fill="white" opacity="0.88" />
            <text textAnchor="middle" y="-3" fontFamily="system-ui,sans-serif" fontSize="8" fill="#a8a29e" fontWeight="600">N</text>
            <line x1="0" y1="-1" x2="0"  y2="-9" stroke="#a8a29e" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="0" y1="3"  x2="0"  y2="9"  stroke="#d6d3ce" strokeWidth="1"   strokeLinecap="round" />
            <line x1="-3" y1="1" x2="-9" y2="1"  stroke="#d6d3ce" strokeWidth="1"   strokeLinecap="round" />
            <line x1="3"  y1="1" x2="9"  y2="1"  stroke="#d6d3ce" strokeWidth="1"   strokeLinecap="round" />
          </g>
        </svg>

        {/* Map markers */}
        <MapMarker left="26%" top="55%" pulse label="HITNO" />
        <MapMarker left="54%" top="40%" pulse delay="0.7s" label="HITNO" />
        <MapMarker left="68%" top="62%" size="sm" />
        <MapMarker left="42%" top="70%" pulse delay="1.2s" label="VEČERAS" labelColor="bg-orange-600" />
        <MapMarker left="16%" top="35%" size="sm" />

        {/* Active jobs badge */}
        <div className="glass absolute top-4 left-4 rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-blink flex-shrink-0" />
          <div>
            <div className="text-xs font-bold text-neutral-800">14 aktivnih oglasa</div>
            <div className="text-[10px] text-neutral-400 font-medium">u tvojoj blizini</div>
          </div>
        </div>

        {/* Zoom controls */}
        <div className="absolute right-4 top-4 flex flex-col gap-1">
          <button className="glass w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-700 font-bold text-lg transition-colors">+</button>
          <button className="glass w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-700 font-bold text-lg transition-colors">−</button>
        </div>

        {/* Floating waiter card */}
        <div className="animate-float glass absolute bottom-5 right-4 rounded-2xl p-3.5 w-48 z-20">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-500 font-bold text-sm">M</div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-orange-400 border-2 border-white" />
            </div>
            <div>
              <div className="text-xs font-bold text-neutral-800">Marko M.</div>
              <div className="flex items-center gap-1">
                <StarRating rating={4.9} size="xs" />
                <span className="text-[10px] font-semibold text-neutral-700">4.9</span>
                <span className="text-[10px] text-neutral-400">· 127</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="bg-orange-50 border border-orange-200 text-orange-600 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <svg width="7" height="7" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Verified
            </span>
            <span className="bg-orange-50 border border-orange-200 text-orange-600 text-[9px] font-bold px-2 py-0.5 rounded-full">Passport™</span>
          </div>
          <div className="text-[10px] text-neutral-400 font-medium">Savamala · Dostupan odmah</div>
          <div className="mt-2.5 w-full bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold text-center py-1.5 rounded-xl transition-colors cursor-pointer">
            Pogledaj profil →
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        {[
          { value: "500+", label: "Beogradski lokali" },
          { value: "2.4k", label: "Aktivnih konobara" },
          { value: "98%",  label: "Stopa uspešnosti" },
        ].map(({ value, label }) => (
          <div key={label} className="bg-white rounded-2xl p-4 text-center border border-neutral-100 shadow-sm">
            <div className="text-2xl font-extrabold text-neutral-900 tracking-tight">
              {value.replace(/[+k%]$/, "")}
              <span className="text-orange-500">{value.match(/[+k%]$/)?.[0]}</span>
            </div>
            <div className="text-xs text-neutral-400 font-medium mt-0.5">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
