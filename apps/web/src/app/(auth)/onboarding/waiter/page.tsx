import Link from "next/link";

const steps = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="#f97316" />
      </svg>
    ),
    title: "Dovrši Waiter Passport™",
    desc: "Dodaj radno iskustvo, veštine i sertifikate. Što je profil potpuniji, to si vidljiviji lokalima.",
    cta: "Uredi profil",
    href: "/waiter/profile",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke="#f97316" strokeWidth="2" />
        <path d="M16.5 16.5L21 21" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: "Pretraži Red Alert™ oglase",
    desc: "Hitni oglasi u tvojoj blizini. Prijavi se jednim klikom — lokal čeka odgovor.",
    cta: "Traži posao",
    href: "/jobs",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M9 12L11 14L15 10" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 3C7.03 3 3 7.03 3 12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3Z" stroke="#f97316" strokeWidth="2" fill="none" />
      </svg>
    ),
    title: "Skupljaj geofencing recenzije",
    desc: "Nakon svake smene, lokal ti šalje verifikovanu ocenu. Gradi Passport™ skor koji te razlikuje od ostalih.",
    cta: "Kako funkcioniše",
    href: "/#how",
  },
];

export default function WaiterOnboardingPage() {
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
                <path d="M12 2L14.09 8.26L21 9.27L16.5 13.64L17.63 20.56L12 17.27L6.37 20.56L7.5 13.64L3 9.27L9.91 8.26L12 2Z" fill="#f97316" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-0.5">Waiter Passport™ aktivan</div>
              <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Sve je spremno!</h1>
              <p className="text-neutral-400 text-sm font-light mt-0.5">Evo šta te čeka kao sledeći korak.</p>
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

          {/* Summary box */}
          <div className="rounded-2xl p-4 mb-6" style={{ background: "#fff7ed", border: "1px solid rgba(249,115,22,0.2)" }}>
            <div className="text-xs font-bold text-orange-600 mb-2">Tvoj Passport™ skor raste sa svakom smenom</div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-orange-100 rounded-full overflow-hidden">
                <div className="h-full w-1/12 rounded-full" style={{ background: "linear-gradient(90deg, #f97316, #ea580c)" }} />
              </div>
              <span className="text-xs font-bold text-orange-500">Početnik</span>
            </div>
            <div className="text-[10px] text-neutral-400 mt-1.5">Završi 3 smene da dobiješ Silver verifikaciju →</div>
          </div>

          <Link
            href="/waiter"
            className="btn-primary w-full text-white font-bold py-3.5 rounded-2xl text-sm text-center block"
          >
            Idi na Dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}
