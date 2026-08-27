import Link from "next/link";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-white border border-orange-200 text-orange-500 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">
      {children}
    </span>
  );
}

function RedAlertCard() {
  return (
    <div className="lg:col-span-3 rounded-3xl p-8 relative overflow-hidden bg-white border border-orange-100 shadow-sm group hover:-translate-y-1 transition-transform duration-200">
      <div className="absolute right-8 top-8 w-40 h-40 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #f97316, transparent 70%)" }} />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-6">
          <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center shadow-md shadow-orange-200">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="white" />
            </svg>
          </div>
          <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-500 text-xs font-black px-3 py-1.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-blink" />
            Red Alert™
          </div>
        </div>

        <h3 className="text-2xl font-extrabold text-neutral-900 mb-3 tracking-tight">Zamena za manje od 15 minuta</h3>
        <p className="text-neutral-500 font-light leading-relaxed mb-8 max-w-lg">
          Konobar otkazao sat vremena pre smene? Aktiviraj Red Alert™ — notifikacija ide svim dostupnim, verifikovanim konobarima u krugu 5km. Prosečno vreme odgovora: <strong className="text-neutral-700 font-semibold">11 minuta.</strong>
        </p>

        {/* Timeline */}
        <div className="flex items-center gap-0 max-w-sm">
          {[
            { label: "Alert\naktiviran",   icon: "pin",   active: true  },
            { label: "Prijave\nstižu",     icon: "bell",  active: false },
            { label: "Zamena\npotvrđena",  icon: "check", active: false },
            { label: "Smena\npokrivena",   icon: "star",  active: true  },
          ].map(({ label, icon, active }, i) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${active ? "bg-orange-500" : "bg-orange-100 border border-orange-200"}`}>
                  {icon === "pin"   && <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1C5.24 1 3 3.24 3 6C3 9.5 8 14 8 14C8 14 13 9.5 13 6C13 3.24 10.76 1 8 1ZM8 7.5C7.17 7.5 6.5 6.83 6.5 6C6.5 5.17 7.17 4.5 8 4.5C8.83 4.5 9.5 5.17 9.5 6C9.5 6.83 8.83 7.5 8 7.5Z" fill="white"/></svg>}
                  {icon === "bell"  && <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.51 1.5 3.5 3.51 3.5 6C3.5 7.85 4.59 9.44 6.14 10.22L5.5 14.5H10.5L9.86 10.22C11.41 9.44 12.5 7.85 12.5 6C12.5 3.51 10.49 1.5 8 1.5Z" stroke="#f97316" strokeWidth="1.3" fill="none"/></svg>}
                  {icon === "check" && <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5L6 12L13.5 4.5" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  {icon === "star"  && <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1L9.545 5.27H14.09L10.273 7.855L11.818 12.125L8 9.54L4.182 12.125L5.727 7.855L1.82 5.27H6.455L8 1Z" fill="white"/></svg>}
                </div>
                <span className="text-[9px] font-semibold text-neutral-400 text-center whitespace-pre-line">{label}</span>
              </div>
              {i < 3 && <div className="flex-1 h-px bg-orange-200 mb-5 w-8" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewsCard() {
  return (
    <div className="lg:col-span-2 rounded-3xl p-7 bg-white border border-orange-100 shadow-sm relative overflow-hidden group hover:-translate-y-1 transition-transform duration-200">
      <div className="absolute bottom-0 right-0 w-32 h-32 rounded-full opacity-5" style={{ background: "#f97316", transform: "translate(30%, 30%)" }} />
      <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center mb-5 shadow-md shadow-orange-100">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L14.09 8.26L21 9.27L16.5 13.64L17.63 20.56L12 17.27L6.37 20.56L7.5 13.64L3 9.27L9.91 8.26L12 2Z" fill="white" />
        </svg>
      </div>
      <h3 className="text-xl font-extrabold text-neutral-900 mb-2 tracking-tight">Prave recenzije, proverene lokacijom</h3>
      <p className="text-neutral-500 font-light text-sm leading-relaxed mb-5">
        Vidite ocene gostiju i prethodnih poslodavaca pre nego što nekoga angažujete. Svaka recenzija zahteva geofencing potvrdu — nema lažnih ocena.
      </p>
      <div className="rounded-2xl p-3.5 border border-orange-100" style={{ background: "#fef9f5" }}>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-lg bg-orange-200 flex items-center justify-center text-[10px] font-bold text-orange-600">S</div>
          <span className="text-xs font-bold text-neutral-700">Salon 1905</span>
          <div className="ml-auto flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg key={i} width="9" height="9" viewBox="0 0 10 10" fill="#f97316"><path d="M5 1L6.18 3.42L9 3.82L7 5.77L7.49 8.58L5 7.24L2.51 8.58L3 5.77L1 3.82L3.82 3.42L5 1Z" /></svg>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-neutral-500 leading-relaxed">&ldquo;Pouzdan, profesionalan, gosti su ga voleli. Angažovaćemo ga ponovo.&rdquo;</p>
        <div className="flex items-center gap-1 mt-2">
          <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M6 1C3.79 1 2 2.79 2 5C2 7.5 6 12 6 12C6 12 10 7.5 10 5C10 2.79 8.21 1 6 1Z" fill="#f97316" /></svg>
          <span className="text-[9px] text-orange-400 font-semibold">Geofencing verifikovano</span>
        </div>
      </div>
    </div>
  );
}

function StatsCard() {
  return (
    <div className="lg:col-span-2 rounded-3xl p-7 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#f97316,#ea580c)", boxShadow: "0 8px 32px rgba(249,115,22,0.25)" }}>
      <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(ellipse at top right, white, transparent 60%)" }} />
      <div className="relative z-10">
        <div className="text-orange-100 text-xs font-bold uppercase tracking-widest mb-6">Rezultati vlasnika</div>
        <div className="flex flex-col gap-5">
          {[
            { value: "11", unit: "min", label: "prosečno vreme pronalaska zamene" },
            { value: "0",  unit: "RSD", label: "naknade agenciji za posredovanje" },
            { value: "94", unit: "%",   label: "vlasnika preporučuje platformu" },
          ].map(({ value, unit, label }) => (
            <div key={unit}>
              <div className="text-white font-black text-4xl tracking-tight">
                {value}<span className="text-orange-200 text-2xl">{unit}</span>
              </div>
              <div className="text-orange-100 text-sm font-light mt-1">{label}</div>
              {unit !== "%" && <div className="w-full h-px bg-orange-400 opacity-40 mt-5" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminCard() {
  const items = [
    { label: "Sanitarne knjižice", icon: "doc"  },
    { label: "Sertifikati",        icon: "star" },
    { label: "Dostupnost tima",    icon: "check"},
    { label: "Istek rokova",       icon: "clock"},
  ];

  return (
    <div className="lg:col-span-3 rounded-3xl p-7 bg-white border border-orange-100 shadow-sm relative overflow-hidden group hover:-translate-y-1 transition-transform duration-200">
      <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-5" style={{ background: "#f97316", transform: "translate(30%,-30%)" }} />
      <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center mb-5 shadow-md shadow-orange-100">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="16" rx="3" stroke="white" strokeWidth="2" fill="none"/>
          <path d="M8 2V6M16 2V6M3 10H21" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <path d="M8 14H10M14 14H16M8 17.5H10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <h3 className="text-xl font-extrabold text-neutral-900 mb-2 tracking-tight">Automatska administracija tima</h3>
      <p className="text-neutral-500 font-light text-sm leading-relaxed mb-6">
        Zaboravite na tabele i podsetnike. eKonobar automatski prati sanitarne knjižice, sertifikate i dostupnost svakog člana tima — i upozorava vas pre isteka roka.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {items.map(({ label, icon }) => (
          <div key={label} className="flex items-center gap-2.5 rounded-2xl px-3.5 py-3 border border-orange-100" style={{ background: "#fef9f5" }}>
            <div className="w-7 h-7 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
              {icon === "doc"   && <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="2" y="1.5" width="10" height="11" rx="2" stroke="#f97316" strokeWidth="1.4" fill="none"/><path d="M4.5 5H9.5M4.5 7.5H7" stroke="#f97316" strokeWidth="1.2" strokeLinecap="round"/></svg>}
              {icon === "star"  && <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1L8.297 4.91H12.412L9.057 7.305L10.354 11.215L7 8.82L3.646 11.215L4.943 7.305L1.588 4.91H5.703L7 1Z" fill="#f97316"/></svg>}
              {icon === "check" && <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="2.5" stroke="#f97316" strokeWidth="1.4" fill="none"/><path d="M5 7L6.5 8.5L9.5 5.5" stroke="#f97316" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              {icon === "clock" && <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1.5C7 1.5 2.5 4 2.5 7.5C2.5 9.98 4.52 12 7 12C9.48 12 11.5 9.98 11.5 7.5C11.5 4 7 1.5 7 1.5Z" stroke="#f97316" strokeWidth="1.3" fill="none" strokeLinejoin="round"/><path d="M7 5V8L8.5 9" stroke="#f97316" strokeWidth="1.2" strokeLinecap="round"/></svg>}
            </div>
            <span className="text-xs font-semibold text-neutral-700">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function B2BSection() {
  return (
    <section className="relative py-28 overflow-hidden" style={{ background: "#fef3e8" }}>
      {/* Decorative lines */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(249,115,22,0.2),transparent)" }} />
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(249,115,22,0.2),transparent)" }} />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="max-w-2xl mb-16">
          <SectionLabel>Za vlasnike lokala</SectionLabel>
          <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.08]">
            Zaboravite na otkazivanje<br />smena u <span className="text-orange-500">poslednji čas.</span>
          </h2>
          <p className="mt-5 text-lg text-neutral-500 font-light leading-relaxed max-w-xl">
            eKonobar vlasnike lokalima daje alate koji eliminišu najveće operativne bolove — od hitnih zamena do automatske administracije.
          </p>
        </div>

        {/* Top row */}
        <div className="grid lg:grid-cols-5 gap-5 mb-5">
          <RedAlertCard />
          <ReviewsCard />
        </div>

        {/* Bottom row */}
        <div className="grid lg:grid-cols-5 gap-5">
          <StatsCard />
          <AdminCard />
        </div>

        {/* CTA strip */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-6 rounded-3xl px-8 py-7 bg-white border border-orange-100 shadow-sm">
          <div>
            <div className="font-extrabold text-xl text-neutral-900 tracking-tight">Spremi lokal za sezonu.</div>
            <div className="text-neutral-400 text-sm font-light mt-1">Besplatna registracija. Prva zamena na nas.</div>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Link href="/register" className="btn-primary text-white font-bold text-sm px-6 py-3 rounded-2xl flex items-center gap-2">
              Postavi oglas
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M9 4L13 8L9 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
            <Link href="/register" className="btn-secondary font-semibold text-sm px-6 py-3 rounded-2xl">Zakaži demo</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
