import Link from "next/link";

const steps = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke="#f97316" strokeWidth="2" />
        <path d="M16.5 16.5L21 21" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: "Pretraži verifikovane konobara",
    desc: "Filtriraj po skoru, veštinama, jezicima i dostupnosti. Pristup celom Passport™ profilu.",
    cta: "Počni pretragu",
    href: "/headhunter/search",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M5 5H19V17H5V5Z" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" />
        <path d="M5 9H19" stroke="#f97316" strokeWidth="2" />
        <path d="M9 13H12" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: "Sačuvaj profile i dodaj beleške",
    desc: "Kreiraj shortlistu kandidata. Uz svaki profil možeš da dodaš privatnu napomenu za sebe.",
    cta: "Sačuvani profili",
    href: "/headhunter/saved",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L14.09 8.26L21 9.27L16.5 13.64L17.63 20.56L12 17.27L6.37 20.56L7.5 13.64L3 9.27L9.91 8.26L12 2Z" fill="#f97316" />
      </svg>
    ),
    title: "Bayesian skor — objektivno rangiranje",
    desc: "Svaki konobar ima 0–100 skor izgrađen iz verifikovanih recenzija i smena. Nema fake ocena.",
    cta: "Kako funkcioniše skor",
    href: "/for-waiters",
  },
];

export default function HeadhunterOnboardingPage() {
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
                <circle cx="11" cy="11" r="7" stroke="#f97316" strokeWidth="2.2" />
                <path d="M16.5 16.5L21 21" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-0.5">Headhunter nalog aktivan</div>
              <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Sve je spremno!</h1>
              <p className="text-neutral-400 text-sm font-light mt-0.5">Pronađi najperspektivnije ugostiteljske talente.</p>
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

          {/* Info box */}
          <div className="rounded-2xl p-4 mb-6" style={{ background: "#fff7ed", border: "1px solid rgba(249,115,22,0.2)" }}>
            <div className="text-xs font-bold text-orange-600 mb-1.5">Šta čini eKonobar drugačijim</div>
            <div className="flex flex-col gap-1">
              {[
                "Svi konobari su provereni — sanitarna knjižica, verifikacioni tier",
                "Passport™ skor ne može da se kupi — gradi se iz stvarnih smena",
                "PRO i PRO+ konobari se pojavljuju prvi u rezultatima pretrage",
              ].map(t => (
                <div key={t} className="flex items-start gap-2">
                  <span className="text-orange-500 text-xs mt-0.5">✓</span>
                  <span className="text-xs text-neutral-500">{t}</span>
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/headhunter"
            className="btn-primary w-full text-white font-bold py-3.5 rounded-2xl text-sm text-center block"
          >
            Idi na Dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}
