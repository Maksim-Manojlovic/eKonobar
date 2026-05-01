import Link from "next/link";

const steps = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="3" stroke="#f97316" strokeWidth="2" fill="none" />
        <path d="M8 2V6M16 2V6M3 10H21" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 14H10M14 14H16M8 17.5H10" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: "Postavi prvi oglas",
    desc: "Definiši smenu, zahteve i platu. Za manje od 2 minuta oglas je vidljiv svim konobarima u blizini.",
    cta: "Postavi oglas",
    href: "/venue/jobs/new",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="#f97316" />
      </svg>
    ),
    title: "Podesi geofencing zonu",
    desc: "Definiši radijus lokala kako bi recenzije bile automatski verifikovane. Štiti te od lažnih ocena.",
    cta: "Podesi lokaciju",
    href: "/venue/settings/location",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L14.09 8.26L21 9.27L16.5 13.64L17.63 20.56L12 17.27L6.37 20.56L7.5 13.64L3 9.27L9.91 8.26L12 2Z" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    title: "Aktiviraj Red Alert™",
    desc: "Treba ti konobar večeras? Jedan klik — i svi dostupni, verifikovani konobari u blizini dobijaju notifikaciju.",
    cta: "Kako funkcioniše",
    href: "/#venues",
  },
];

const stats = [
  { value: "11", unit: "min", label: "prosečno vreme odgovora" },
  { value: "0", unit: "RSD", label: "naknade agenciji" },
  { value: "94", unit: "%", label: "vlasnika preporučuje" },
];

export default function VenueOnboardingPage() {
  return (
    <div className="w-full max-w-lg">
      <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden fade-up">
        <div style={{ height: "3px", background: "linear-gradient(90deg, #f97316, #ea580c)" }} />

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #fff7ed, #ffedd5)", border: "1px solid #fed7aa" }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="6" width="18" height="14" rx="3" stroke="#f97316" strokeWidth="2" fill="none" />
                <path d="M3 10H21M9 6V4C9 3.45 9.45 3 10 3H14C14.55 3 15 3.45 15 4V6" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-0.5">Lokal registrovan</div>
              <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Sve je spremno!</h1>
              <p className="text-neutral-400 text-sm font-light mt-0.5">Počni da pronalaziš konobara odmah.</p>
            </div>
          </div>

          {/* Steps */}
          <div className="flex flex-col gap-4 mb-8">
            {steps.map((s, i) => (
              <Link
                key={i}
                href={s.href}
                className="flex items-start gap-4 rounded-2xl p-4 border border-neutral-100 hover:border-orange-200 hover:bg-orange-50/50 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {s.icon}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-neutral-800 mb-0.5">{s.title}</div>
                  <div className="text-xs text-neutral-400 font-light leading-relaxed">{s.desc}</div>
                </div>
                <svg
                  width="14" height="14" viewBox="0 0 16 16" fill="none"
                  className="text-neutral-300 group-hover:text-orange-400 transition-colors flex-shrink-0 mt-0.5"
                >
                  <path d="M4 8H12M8 4L12 8L8 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {stats.map(({ value, unit, label }) => (
              <div key={label} className="rounded-2xl p-3 text-center" style={{ background: "#fff7ed", border: "1px solid rgba(249,115,22,0.15)" }}>
                <div className="text-2xl font-black text-neutral-900 leading-none">
                  {value}
                  <span className="text-orange-500 text-lg">{unit}</span>
                </div>
                <div className="text-[10px] text-neutral-400 mt-1 leading-tight">{label}</div>
              </div>
            ))}
          </div>

          <Link
            href="/venue"
            className="btn-primary w-full text-white font-bold py-3.5 rounded-2xl text-sm text-center block"
          >
            Idi na Dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}
