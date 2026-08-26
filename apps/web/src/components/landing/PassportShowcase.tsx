const CheckCircle = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M6 1C3.24 1 1 3.24 1 6C1 8.76 3.24 11 6 11C8.76 11 11 8.76 11 6C11 3.24 8.76 1 6 1ZM4.5 8.5L2.5 6.5L3.21 5.79L4.5 7.08L8.79 2.79L9.5 3.5L4.5 8.5Z" fill="#f97316" />
  </svg>
);

function FeatureItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <div className="font-semibold text-neutral-800 text-sm">{title}</div>
        <div className="text-neutral-400 text-sm font-light mt-0.5 leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

const badges = [
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="2" y="1.5" width="10" height="11" rx="2" stroke="#f97316" strokeWidth="1.4" fill="none" />
        <path d="M4.5 5H9.5M4.5 7.5H9.5M4.5 10H7" stroke="#f97316" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    title: "Sanitarna",
    sub: "knjižica",
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1.5C5.07 1.5 3.5 3.07 3.5 5C3.5 6.5 4.4 7.78 5.68 8.33L5 12.5H9L8.32 8.33C9.6 7.78 10.5 6.5 10.5 5C10.5 3.07 8.93 1.5 7 1.5Z" stroke="#f97316" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
      </svg>
    ),
    title: "Somelijer",
    sub: "sertifikat",
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 4.5C2 4.5 4 3 7 3C10 3 12 4.5 12 4.5" stroke="#f97316" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M2 7C2 7 4 5.5 7 5.5C10 5.5 12 7 12 7" stroke="#f97316" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M2 9.5C2 9.5 4 8 7 8C10 8 12 9.5 12 9.5" stroke="#f97316" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
    title: "Engleski",
    sub: "B2 nivo",
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1L8.297 4.91H12.412L9.057 7.305L10.354 11.215L7 8.82L3.646 11.215L4.943 7.305L1.588 4.91H5.703L7 1Z" fill="#f97316" />
      </svg>
    ),
    title: "Verified",
    sub: "History",
  },
];

const history = [
  { venue: "Salon 1905", shifts: 12, rating: "5.0", active: true },
  { venue: "Freestyler",  shifts: 8,  rating: "4.8", active: true },
  { venue: "Bar Central", shifts: 5,  rating: "4.9", active: false },
];

function ScoreRing() {
  return (
    <div className="flex-shrink-0 relative w-12 h-12">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle
          cx="24" cy="24" r="20" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round"
          strokeDasharray="125.6" strokeDashoffset="12.6"
          transform="rotate(-90 24 24)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-white font-black text-sm leading-none">98</span>
        <span className="text-neutral-500 text-[8px] font-medium">skor</span>
      </div>
    </div>
  );
}

export function PassportShowcase() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-28">
      <div className="grid lg:grid-cols-2 gap-16 items-center">

        {/* Left: copy */}
        <div className="flex flex-col gap-7">
          <div>
            <span className="inline-block bg-orange-50 border border-orange-100 text-orange-500 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">
              Waiter Passport™
            </span>
            <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-900 tracking-tight leading-tight">
              Tvoja biografija koja<br />se sama <span className="text-orange-500">gradi.</span>
            </h2>
          </div>

          <p className="text-lg text-neutral-500 font-light leading-relaxed">
            Svaka smena potvrđena geofencingom automatski postaje deo tvog digitalnog pasoša. Bez papira, bez telefona, bez čekanja.
          </p>

          <div className="flex flex-col gap-4">
            <FeatureItem
              icon={
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 2C5.13 2 2 5.13 2 9C2 12.87 5.13 16 9 16C12.87 16 16 12.87 16 9C16 5.13 12.87 2 9 2ZM7.5 12.5L4.5 9.5L5.56 8.44L7.5 10.38L12.44 5.44L13.5 6.5L7.5 12.5Z" fill="#f97316" />
                </svg>
              }
              title="Geofencing verifikacija"
              desc="Svaka smena se automatski beleži kada si na lokaciji lokala. Niko ne može lažirati iskustvo."
            />
            <FeatureItem
              icon={
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="3" y="2" width="12" height="14" rx="2.5" stroke="#f97316" strokeWidth="1.8" fill="none" />
                  <path d="M6 6H12M6 9H12M6 12H9" stroke="#f97316" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              }
              title="Digitalni bedževi"
              desc="Sanitarna knjižica, Somelijer, Engleski jezik i još 20+ sertifikata — sve na jednom mestu, uvek ažurno."
            />
            <FeatureItem
              icon={
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 2L10.854 7.09H16.18L11.663 10.319L13.517 15.41L9 12.18L4.483 15.41L6.337 10.319L1.82 7.09H7.146L9 2Z" fill="#f97316" />
                </svg>
              }
              title="Putuje sa tobom"
              desc="Menjaj lokale, zadržavaj reputaciju. Passport se ne resetuje — svaki angažman dodaje vrednost."
            />
          </div>

          <a href="#passport" className="inline-flex items-center gap-2 text-orange-500 font-semibold text-sm hover:text-orange-600 transition-colors self-start">
            Saznaj više o Passport™ sistemu
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        {/* Right: passport card */}
        <div className="relative flex items-center justify-center">

          {/* Glow */}
          <div
            className="absolute w-80 h-80 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #f97316, transparent 70%)", filter: "blur(40px)" }}
          />

          {/* Card */}
          <div
            className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            style={{
              background: "linear-gradient(160deg, #1c1209 0%, #2a1a08 100%)",
              border: "1px solid rgba(249,115,22,0.25)",
            }}
          >
            {/* Card header */}
            <div
              className="px-6 pt-6 pb-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-orange-500 flex items-center justify-center">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1C4.24 1 2 3.24 2 6C2 9.5 7 14 7 14C7 14 12 9.5 12 6C12 3.24 9.76 1 7 1ZM7 7.5C6.17 7.5 5.5 6.83 5.5 6C5.5 5.17 6.17 4.5 7 4.5C7.83 4.5 8.5 5.17 8.5 6C8.5 6.83 7.83 7.5 7 7.5Z" fill="white" />
                  </svg>
                </div>
                <span className="text-white font-bold text-sm tracking-tight">Waiter Passport™</span>
              </div>
              <div className="flex items-center gap-1.5 bg-orange-500/20 border border-orange-500/30 px-2.5 py-1 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                <span className="text-orange-300 text-[10px] font-bold">AKTIVAN</span>
              </div>
            </div>

            {/* Profile */}
            <div className="px-6 py-5 flex items-center gap-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl" style={{ background: "linear-gradient(135deg, #fb923c, #f97316)" }}>
                  M
                </div>
                <div
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-orange-500 border-2 flex items-center justify-center"
                  style={{ borderColor: "#1c1209" }}
                >
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5L4 7.5L8.5 2" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <div className="text-white font-extrabold text-lg tracking-tight">Marko Milošević</div>
                <div className="text-neutral-400 text-xs font-medium mt-0.5">Konobar · Beograd</div>
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} width="10" height="10" viewBox="0 0 10 10" fill="#f97316">
                        <path d="M5 1L6.18 3.42L9 3.82L7 5.77L7.49 8.58L5 7.24L2.51 8.58L3 5.77L1 3.82L3.82 3.42L5 1Z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-white font-bold text-xs">4.9</span>
                  <span className="text-neutral-500 text-[10px]">· 127 smena</span>
                </div>
              </div>
              <ScoreRing />
            </div>

            {/* Badges grid */}
            <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest mb-3">Verifikovani bedževi</div>
              <div className="grid grid-cols-2 gap-2">
                {badges.map((b) => (
                  <div
                    key={b.title}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                    style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.25)" }}
                  >
                    <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                      {b.icon}
                    </div>
                    <div>
                      <div className="text-white text-[10px] font-bold leading-tight">{b.title}</div>
                      <div className="text-orange-400 text-[9px] font-medium">{b.sub}</div>
                    </div>
                    <CheckCircle />
                  </div>
                ))}
              </div>
            </div>

            {/* Work history */}
            <div className="px-6 py-4">
              <div className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest mb-3">Istorija angažmana</div>
              <div className="flex flex-col gap-2.5">
                {history.map((h) => (
                  <div key={h.venue} className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5 ${h.active ? "bg-orange-400" : "bg-neutral-700"}`} />
                    <div className="flex-1 flex items-center justify-between">
                      <div>
                        <span className={`text-[11px] font-semibold ${h.active ? "text-white" : "text-neutral-400"}`}>{h.venue}</span>
                        <span className={`text-[10px] ml-1.5 ${h.active ? "text-neutral-500" : "text-neutral-600"}`}>· {h.shifts} smena</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="#f97316">
                          <path d="M5 1L6.18 3.42L9 3.82L7 5.77L7.49 8.58L5 7.24L2.51 8.58L3 5.77L1 3.82L3.82 3.42L5 1Z" />
                        </svg>
                        <span className={`text-[10px] font-semibold ${h.active ? "text-neutral-300" : "text-neutral-400"}`}>{h.rating}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card CTA */}
            <div className="px-6 pb-5">
              <div
                className="w-full rounded-2xl py-3 text-center text-white font-bold text-sm cursor-pointer transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", boxShadow: "0 4px 16px rgba(249,115,22,0.3)" }}
              >
                Napravi svoj Passport™ →
              </div>
            </div>
          </div>

          {/* Floating geo badge */}
          <div
            className="absolute -left-4 top-1/3 rounded-2xl px-3.5 py-2.5 items-center gap-2.5 shadow-lg hidden lg:flex"
            style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(249,115,22,0.2)" }}
          >
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M8 1C5.24 1 3 3.24 3 6C3 9.5 8 15 8 15C8 15 13 9.5 13 6C13 3.24 10.76 1 8 1ZM8 7.5C7.17 7.5 6.5 6.83 6.5 6C6.5 5.17 7.17 4.5 8 4.5C8.83 4.5 9.5 5.17 9.5 6C9.5 6.83 8.83 7.5 8 7.5Z" fill="#f97316" />
              </svg>
            </div>
            <div>
              <div className="text-[10px] font-bold text-neutral-800">Geofencing</div>
              <div className="text-[9px] text-orange-500 font-semibold">Smena verifikovana ✓</div>
            </div>
          </div>

          {/* Floating achievement badge */}
          <div
            className="absolute -right-4 bottom-1/4 rounded-2xl px-3.5 py-2.5 shadow-lg hidden lg:block"
            style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(249,115,22,0.2)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <div>
                <div className="text-[10px] font-bold text-neutral-800">Top 5%</div>
                <div className="text-[9px] text-neutral-400">u Beogradu</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
