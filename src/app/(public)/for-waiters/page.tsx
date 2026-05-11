import Link from "next/link";
import { FAQAccordion, type FAQItem } from "@/components/ui/FAQAccordion";
import { NavAuthButton } from "@/components/ui/NavAuthButton";

const LogoMark = () => (
  <div className="logo-mark w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 3C7 3 4.5 5.5 4.5 8.5C4.5 12.5 10 18 10 18C10 18 15.5 12.5 15.5 8.5C15.5 5.5 13 3 10 3Z" fill="white" opacity="0.95" />
      <circle cx="10" cy="8.5" r="2.2" fill="white" />
    </svg>
  </div>
);

const CheckCircle = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
    <circle cx="8" cy="8" r="7" fill="#fed7aa" />
    <path d="M5 8L7 10L11 6" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const faqItems: FAQItem[] = [
  {
    question: "Mogu li poneti Passport iz Beograda u Novi Sad ili Zagreb?",
    answer: (
      <>
        Da. Passport je vezan za tebe, ne za grad. Trenutno radimo u Beogradu, Novom Sadu i Nišu — Zagreb stiže u Q3 2026. Tier i sve recenzije se prenose, ne resetuju.
      </>
    ),
  },
  {
    question: "Šta ako vlasnik napiše nepravednu negativnu recenziju?",
    answer: (
      <>
        Imaš 14 dana da uložiš prigovor — naš tim moderira spor i može{" "}
        <strong className="font-semibold text-neutral-700">povući recenziju</strong> ako su dokazi nedosledni. Vlasnici sa istorijom nepravednih ocena gube pravo ocenjivanja.
      </>
    ),
  },
  {
    question: "Mogu li sakriti loš tier od poslodavca?",
    answer: (
      <>
        Ne — to je suština sistema. Ali Bronze tier{" "}
        <strong className="font-semibold text-neutral-700">nije rupa</strong>; svi smo počeli odatle. Lokali koji traže iskusne ljude filtriraju Gold+, ali ima podosta otvorenih ka početnicima.
      </>
    ),
  },
  {
    question: "Da li tier opada ako mesec dana ne radim?",
    answer: (
      <>
        Tier ne opada nikada — broj smena ostaje. Ali aktivnost u poslednjih 90 dana{" "}
        <strong className="font-semibold text-neutral-700">poboljšava prioritet</strong> u algoritmu preporuke. Ako planiraš pauzu, postaviš status „nedostupan&rdquo; i ne kvariš statistiku.
      </>
    ),
  },
  {
    question: "Koliko košta kreiranje i održavanje Passport-a?",
    answer: (
      <>
        <strong className="font-semibold text-neutral-700">Konobarima je sve besplatno — uvek.</strong> Provizija postoji samo za vlasnike lokala (5–8% po angažmanu). Tvoj profil, sertifikati, geofencing — bez ijednog dinara.
      </>
    ),
  },
];

export default function ForWaitersPage() {
  return (
    <div className="hero-bg min-h-screen">

      {/* ── NAV ── */}
      <nav className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <LogoMark />
          <span className="font-bold text-xl tracking-tight text-gray-900">eKonobar</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
          <a href="#kako-radi" className="hover:text-neutral-800 transition-colors">Passport™</a>
          <a href="#tierovi" className="hover:text-neutral-800 transition-colors">Tierovi</a>
          <a href="#faq" className="hover:text-neutral-800 transition-colors">FAQ</a>
        </div>
        <div className="flex items-center gap-3">
          <NavAuthButton />
          <Link href="/register" className="btn-primary text-white text-sm font-semibold px-5 py-2.5 rounded-2xl">Registracija</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="max-w-7xl mx-auto px-6 pt-12 pb-24">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-14 items-center">

          {/* LEFT */}
          <div className="flex flex-col gap-7">
            <div className="inline-flex items-center gap-2 self-start">
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-orange-500">Waiter Passport™</span>
              <span className="w-8 h-px bg-orange-200" />
              <span className="text-[11px] font-medium tracking-wider uppercase text-neutral-400">Reputacija koja putuje s tobom</span>
            </div>

            <h1 className="text-5xl xl:text-[64px] font-extrabold text-gray-900 leading-[1.05] tracking-tight">
              Tvoj posao<br />nije
              <span className="relative inline-block ml-2">
                <span className="text-orange-500">CV.</span>
                <svg className="absolute -bottom-2 left-0 w-full" height="7" viewBox="0 0 60 7" fill="none" preserveAspectRatio="none">
                  <path d="M2 5.5C12 2 24 5.5 30 3.5C36 1.5 48 5.5 58 3.5" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
                </svg>
              </span>
              <br />To je
              <span className="text-orange-500"> Passport™.</span>
            </h1>

            <p className="text-lg text-neutral-500 font-light leading-relaxed max-w-xl">
              Svaka smena, svaka recenzija, svaki sertifikat — automatski u jednom profilu.{" "}
              <strong className="font-semibold text-neutral-700">Bez papira.</strong> Bez objašnjavanja. Vlasnici lokala vide isti profil koji ti je pratio kroz svaku smenu u Beogradu.
            </p>

            <div className="flex flex-col gap-2.5 max-w-lg">
              {[
                <>Geofencing potvrđuje da si <strong className="font-semibold text-neutral-800">stvarno radio smenu</strong> — niko ne može lažirati iskustvo.</>,
                <>Recenzije su vezane za lokal — <strong className="font-semibold text-neutral-800">ne može ih obrisati niko</strong>, ni ti ni vlasnik.</>,
                <>Tieri (Bronze → Platinum) <strong className="font-semibold text-neutral-800">otkljuĉavaju bolje pozicije</strong> i veće zarade.</>,
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-neutral-600">
                  <CheckCircle />
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link href="/register" className="btn-primary text-white font-bold text-base px-8 py-4 rounded-2xl flex items-center gap-2.5">
                Napravi svoj Passport™
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M9 4L13 8L9 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
              <Link href="#kako-radi" className="btn-secondary font-semibold text-base px-8 py-4 rounded-2xl flex items-center gap-2.5">Vidi kako radi</Link>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-neutral-200/60 max-w-lg">
              <div>
                <div className="font-extrabold text-2xl text-neutral-900">2.400+</div>
                <div className="text-[11px] text-neutral-400 font-medium mt-0.5">aktivnih Passporta</div>
              </div>
              <div className="border-l border-neutral-200/60 pl-6">
                <div className="font-extrabold text-2xl text-neutral-900">43%</div>
                <div className="text-[11px] text-neutral-400 font-medium mt-0.5">brže do prve smene</div>
              </div>
              <div className="border-l border-neutral-200/60 pl-6">
                <div className="font-extrabold text-2xl text-neutral-900">4.8★</div>
                <div className="text-[11px] text-neutral-400 font-medium mt-0.5">prosečna ocena</div>
              </div>
            </div>
          </div>

          {/* RIGHT — Passport Card */}
          <div className="relative flex items-center justify-center">
            <div className="absolute w-80 h-80 rounded-full opacity-25" style={{ background: "radial-gradient(circle, #f97316, transparent 70%)", filter: "blur(48px)" }} />

            <div className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl float-card"
              style={{ background: "linear-gradient(160deg, #1c1209 0%, #2a1a08 100%)", border: "1px solid rgba(249,115,22,0.25)" }}>

              {/* Card header */}
              <div className="px-6 pt-6 pb-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-orange-500 flex items-center justify-center">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1C4.24 1 2 3.24 2 6C2 9.5 7 14 7 14C7 14 12 9.5 12 6C12 3.24 9.76 1 7 1ZM7 7.5C6.17 7.5 5.5 6.83 5.5 6C5.5 5.17 6.17 4.5 7 4.5C7.83 4.5 8.5 5.17 8.5 6C8.5 6.83 7.83 7.5 7 7.5Z" fill="white" /></svg>
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
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center text-white font-black text-2xl">M</div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-orange-500 border-2 flex items-center justify-center" style={{ borderColor: "#1c1209" }}>
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-white font-extrabold text-lg tracking-tight">Marko Milošević</div>
                  <div className="text-neutral-400 text-xs font-medium mt-0.5">Konobar · Beograd</div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} width="10" height="10" viewBox="0 0 10 10" fill="#f97316"><path d="M5 1L6.18 3.42L9 3.82L7 5.77L7.49 8.58L5 7.24L2.51 8.58L3 5.77L1 3.82L3.82 3.42L5 1Z" /></svg>
                      ))}
                    </div>
                    <span className="text-white font-bold text-xs">4.9</span>
                    <span className="text-neutral-500 text-[10px]">· 127 smena</span>
                  </div>
                </div>
                <div className="flex-shrink-0 relative w-12 h-12">
                  <svg width="48" height="48" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                    <circle cx="24" cy="24" r="20" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round"
                      strokeDasharray="125.6" strokeDashoffset="12.6" transform="rotate(-90 24 24)" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-white font-black text-sm leading-none">98</span>
                    <span className="text-neutral-500 text-[8px] font-medium">skor</span>
                  </div>
                </div>
              </div>

              {/* Tier strip */}
              <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg tier-gold flex items-center justify-center">
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="white"><path d="M6 1L7.42 4.13L10.85 4.66L8.42 7.05L9 10.45L6 8.84L3 10.45L3.58 7.05L1.15 4.66L4.58 4.13L6 1Z" /></svg>
                    </div>
                    <span className="text-white text-xs font-bold tracking-tight">GOLD tier</span>
                  </div>
                  <span className="text-orange-400 text-[10px] font-semibold">127 / 150 do Platinum</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-full" style={{ width: "84%", background: "linear-gradient(90deg, #f97316, #fbbf24)" }} />
                </div>
              </div>

              {/* Badges */}
              <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest mb-3">Verifikovani bedževi</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Sanitarna", sub: "knjižica" },
                    { label: "Somelijer", sub: "sertifikat" },
                    { label: "Engleski", sub: "B2 nivo" },
                    { label: "Verified", sub: "History" },
                  ].map((badge) => (
                    <div key={badge.label} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                      style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.25)" }}>
                      <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </div>
                      <div>
                        <div className="text-white text-[10px] font-bold leading-tight">{badge.label}</div>
                        <div className="text-orange-400 text-[9px] font-medium">{badge.sub}</div>
                      </div>
                      <svg className="ml-auto flex-shrink-0" width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M6 1C3.24 1 1 3.24 1 6C1 8.76 3.24 11 6 11C8.76 11 11 8.76 11 6C11 3.24 8.76 1 6 1ZM4.5 8.5L2.5 6.5L3.21 5.79L4.5 7.08L8.79 2.79L9.5 3.5L4.5 8.5Z" fill="#f97316" />
                      </svg>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer hash */}
              <div className="px-6 py-3.5 flex items-center justify-between">
                <div className="text-neutral-500 text-[9px] font-mono tracking-wide">#WP-2024-0M127·BG</div>
                <div className="flex items-center gap-1.5">
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#f97316" strokeWidth="1.4" /><path d="M6 3V6L8 7.5" stroke="#f97316" strokeWidth="1.4" strokeLinecap="round" /></svg>
                  <span className="text-orange-400 text-[9px] font-semibold">Last sync: 2min</span>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -left-4 top-12 rounded-2xl px-3.5 py-2.5 items-center gap-2.5 shadow-lg hidden lg:flex"
              style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(249,115,22,0.2)" }}>
              <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1C5.24 1 3 3.24 3 6C3 9.5 8 15 8 15C8 15 13 9.5 13 6C13 3.24 10.76 1 8 1ZM8 7.5C7.17 7.5 6.5 6.83 6.5 6C6.5 5.17 7.17 4.5 8 4.5C8.83 4.5 9.5 5.17 9.5 6C9.5 6.83 8.83 7.5 8 7.5Z" fill="#f97316" /></svg>
              </div>
              <div>
                <div className="text-[10px] font-bold text-neutral-800">Geofencing</div>
                <div className="text-[9px] text-orange-500 font-semibold">Smena verifikovana ✓</div>
              </div>
            </div>
            <div className="absolute -right-4 bottom-20 rounded-2xl px-3.5 py-2.5 shadow-lg hidden lg:block"
              style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(249,115,22,0.2)" }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl tier-gold flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="white"><path d="M6 1L7.42 4.13L10.85 4.66L8.42 7.05L9 10.45L6 8.84L3 10.45L3.58 7.05L1.15 4.66L4.58 4.13L6 1Z" /></svg>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-neutral-800">Top 5%</div>
                  <div className="text-[9px] text-neutral-400">u Beogradu</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider max-w-7xl mx-auto" />

      {/* ── ANATOMIJA PASSPORTA ── */}
      <section id="kako-radi" className="max-w-7xl mx-auto px-6 py-24">
        <div className="max-w-2xl mb-14">
          <span className="inline-block bg-orange-50 border border-orange-100 text-orange-500 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">Anatomija passporta</span>
          <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">
            Šta je <span className="text-orange-500">unutra</span>, i zašto se ne može lažirati.
          </h2>
          <p className="mt-4 text-lg text-neutral-500 font-light leading-relaxed">
            Passport ima šest komponenti. Svaka je verifikovana — sistemom, lokalom, ili oboma.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { num: "01", title: "Verifikovani identitet", desc: "Lična karta, broj telefona, jedinstven foto. Jedan profil po osobi — bez lažnih duplikata." },
            { num: "02", title: "Geofencing istorija smena", desc: "Aplikacija beleži svaki check-in u krugu od 5km od lokala. Ako nisi tu — smena se ne računa." },
            { num: "03", title: "Recenzije po lokalu", desc: "Vlasnik ocenjuje samo nakon završene smene. Ti ocenjuješ vlasnika. Obe ocene su trajne." },
            { num: "04", title: "Sertifikati i bedževi", desc: "Sanitarna knjižica, somelijer, jezici, HACCP — uploduješ jednom, eKonobar verifikuje, koristiš svuda." },
            { num: "05", title: "Pouzdanost (no-show indeks)", desc: "Skor koji prati: zakazane vs. održane smene, kašnjenja, otkazane na poslednji čas. Vlasnici ga vide odmah." },
            { num: "06", title: "Tier (Bronze → Platinum)", desc: "Algoritam kombinuje sve gore navedeno u jedan tier. Viši tier = prednost na konkurenciji + Red Alert™ pristup.", dark: true },
          ].map((card) => (
            card.dark ? (
              <div key={card.num} className="rounded-3xl p-7 relative overflow-hidden"
                style={{ background: "linear-gradient(160deg, #1c1209 0%, #2a1a08 100%)", border: "1px solid rgba(249,115,22,0.25)" }}>
                <div className="flex items-start justify-between mb-5 relative z-10">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(249,115,22,0.18)", border: "1px solid rgba(249,115,22,0.3)" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 2L14.09 8.26L21 9.27L16.5 13.64L17.63 20.56L12 17.27L6.37 20.56L7.5 13.64L3 9.27L9.91 8.26L12 2Z" /></svg>
                  </div>
                  <span className="text-[10px] font-black text-orange-300 bg-orange-500/15 px-2 py-0.5 rounded-full tracking-wider border border-orange-500/30">{card.num}</span>
                </div>
                <h3 className="font-bold text-lg text-white mb-2 relative z-10">{card.title}</h3>
                <p className="text-sm text-neutral-400 font-light leading-relaxed relative z-10">{card.desc}</p>
                <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full opacity-30" style={{ background: "radial-gradient(circle, #f97316, transparent 70%)", filter: "blur(20px)" }} />
              </div>
            ) : (
              <div key={card.num} className="bg-white rounded-3xl p-7 border border-neutral-100 hover:border-orange-200 transition-colors">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#f97316" strokeWidth="1.8" /><path d="M8 12L11 15L16 9" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full tracking-wider">{card.num}</span>
                </div>
                <h3 className="font-bold text-lg text-neutral-900 mb-2">{card.title}</h3>
                <p className="text-sm text-neutral-500 font-light leading-relaxed">{card.desc}</p>
              </div>
            )
          ))}
        </div>
      </section>

      {/* ── TIER LADDER ── */}
      <section id="tierovi" className="relative py-24 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #fafaf8 0%, #f5f1ec 100%)" }} />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-14">
            <div>
              <span className="inline-block bg-orange-50 border border-orange-100 text-orange-500 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">Tieri</span>
              <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">
                Što više radiš,<br />to <span className="text-orange-500">više radiš.</span>
              </h2>
            </div>
            <p className="text-base text-neutral-500 font-light leading-relaxed max-w-md">
              Tier raste sa svakom verifikovanom smenom i ocenom. Što je tier viši — to brže vidiš najbolje oglase, sa boljom platom i fiksnim mestima.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Bronze */}
            <div className="tier-card bg-white rounded-3xl p-6 border border-neutral-100">
              <div className="w-14 h-14 rounded-2xl tier-bronze flex items-center justify-center mb-5 shadow-md">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 2L14.09 8.26L21 9.27L16.5 13.64L17.63 20.56L12 17.27L6.37 20.56L7.5 13.64L3 9.27L9.91 8.26L12 2Z" /></svg>
              </div>
              <div className="text-[10px] font-black tracking-[0.2em] uppercase text-amber-700 mb-1">Tier 1</div>
              <h3 className="font-extrabold text-2xl text-neutral-900 mb-1">Bronze</h3>
              <p className="text-xs text-neutral-400 font-medium mb-4">0 – 24 smene</p>
              <ul className="flex flex-col gap-2 text-xs text-neutral-600 font-light">
                {["Osnovni profil + verifikacija", "Pristup standardnim oglasima", "Plaćanje 24h nakon smene"].map(item => (
                  <li key={item} className="flex gap-2">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Silver */}
            <div className="tier-card bg-white rounded-3xl p-6 border border-neutral-100">
              <div className="w-14 h-14 rounded-2xl tier-silver flex items-center justify-center mb-5 shadow-md">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 2L14.09 8.26L21 9.27L16.5 13.64L17.63 20.56L12 17.27L6.37 20.56L7.5 13.64L3 9.27L9.91 8.26L12 2Z" /></svg>
              </div>
              <div className="text-[10px] font-black tracking-[0.2em] uppercase text-neutral-600 mb-1">Tier 2</div>
              <h3 className="font-extrabold text-2xl text-neutral-900 mb-1">Silver</h3>
              <p className="text-xs text-neutral-400 font-medium mb-4">25 – 74 smene</p>
              <ul className="flex flex-col gap-2 text-xs text-neutral-600 font-light">
                {["Sve iz Bronze tiera", "Red Alert™ – 30min ranije", "Plaćanje istog dana", "Personalna preporuka oglasa"].map(item => (
                  <li key={item} className="flex gap-2">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#78716c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Gold */}
            <div className="tier-card rounded-3xl p-6 relative overflow-hidden"
              style={{ background: "linear-gradient(160deg, #f97316, #ea580c)", boxShadow: "0 8px 32px rgba(249,115,22,0.32)" }}>
              <div className="absolute top-5 right-5 bg-white/20 border border-white/30 text-white text-[9px] font-black px-2.5 py-1 rounded-full tracking-wider">TVOJ TIER</div>
              <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center mb-5 shadow-md">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#f97316"><path d="M12 2L14.09 8.26L21 9.27L16.5 13.64L17.63 20.56L12 17.27L6.37 20.56L7.5 13.64L3 9.27L9.91 8.26L12 2Z" /></svg>
              </div>
              <div className="text-[10px] font-black tracking-[0.2em] uppercase text-orange-100 mb-1">Tier 3</div>
              <h3 className="font-extrabold text-2xl text-white mb-1">Gold</h3>
              <p className="text-xs text-orange-100 font-medium mb-4">75 – 149 smena</p>
              <ul className="flex flex-col gap-2 text-xs text-white/90 font-light">
                {["Sve iz Silver tiera", "Red Alert™ – 1h ranije", "+15% prosečna napojnica", "Featured profil za vlasnike", "Bez provizije za prve 2 smene"].map(item => (
                  <li key={item} className="flex gap-2">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Platinum */}
            <div className="tier-card rounded-3xl p-6 relative overflow-hidden"
              style={{ background: "linear-gradient(160deg, #1c1209 0%, #2a1a08 100%)", border: "1px solid rgba(249,115,22,0.25)" }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: "rgba(249,115,22,0.18)", border: "1px solid rgba(249,115,22,0.4)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#f97316"><path d="M12 2L14.09 8.26L21 9.27L16.5 13.64L17.63 20.56L12 17.27L6.37 20.56L7.5 13.64L3 9.27L9.91 8.26L12 2Z" /></svg>
              </div>
              <div className="text-[10px] font-black tracking-[0.2em] uppercase text-orange-400 mb-1">Tier 4</div>
              <h3 className="font-extrabold text-2xl text-white mb-1">Platinum</h3>
              <p className="text-xs text-neutral-500 font-medium mb-4">150+ smena</p>
              <ul className="flex flex-col gap-2 text-xs text-neutral-300 font-light">
                {["Sve iz Gold tiera", "Red Alert™ – odmah", "Pristup ekskluzivnim lokalima", "Personalni manager", "0% provizija – zauvek"].map(item => (
                  <li key={item} className="flex gap-2">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── POGLED VLASNIKA (dark) ── */}
      <section className="relative py-28 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #1a1209 0%, #2d1a06 50%, #1c110a 100%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 60% at 20% 50%, rgba(249,115,22,0.18) 0%, transparent 55%), radial-gradient(ellipse 50% 70% at 80% 30%, rgba(234,88,12,0.12) 0%, transparent 55%)" }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 48px), repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 48px)" }} />

        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-16 items-center">
            <div className="flex flex-col gap-7">
              <span className="inline-block bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full self-start">Pogled vlasnika</span>
              <h2 className="text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-[1.1]">
                Vlasnici vide<br />tačno <span className="text-orange-400">isto</span> što i ti.
              </h2>
              <p className="text-base text-neutral-400 font-light leading-relaxed max-w-md">
                Bez skrivenih napomena, bez „off-the-record&rdquo; sistema. Tvoj passport je transparentan dokument koji svi gledaju iz iste tačke.
              </p>
              <div className="flex flex-col gap-4">
                {[
                  { n: "1", title: "Vlasnik filtrira po Passport™ kriterijumima", desc: "Tier, lokacija, dostupnost, sertifikati. Vidi samo relevantne profile." },
                  { n: "2", title: "Otvara tvoj profil — bez polovičnih informacija", desc: "Sve recenzije, sve smene, svi bedževi — odmah, bez tela mejlova." },
                  { n: "3", title: `Šalje ti ponudu — ti potvrđuješ jednim klikom`, desc: `Bez razgovora, bez „pošalji CV". Ako ti odgovara — radiš.` },
                ].map(step => (
                  <div key={step.n} className="flex gap-4">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-orange-400 font-bold text-sm">{step.n}</span>
                    </div>
                    <div>
                      <div className="text-white font-semibold text-base">{step.title}</div>
                      <div className="text-neutral-400 text-sm font-light mt-1">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Owner view mockup */}
            <div className="relative">
              <div className="rounded-3xl overflow-hidden shadow-2xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}>
                <div className="px-5 py-3 flex items-center gap-3" style={{ background: "rgba(0,0,0,0.25)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex gap-1.5">
                    {[...Array(3)].map((_, i) => <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />)}
                  </div>
                  <div className="flex-1 text-center text-[10px] font-mono text-neutral-500">ekonobar.rs/lokal/salon-1905/kandidati</div>
                </div>
                <div className="p-6 flex flex-col gap-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-white font-bold text-sm">Kandidati za smenu · 02. maj</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                      <span className="w-2 h-2 rounded-full bg-orange-400 blink" />
                      Filter: Gold+, Sanitarna, Engleski
                    </div>
                  </div>
                  <div className="rounded-2xl p-4 relative"
                    style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.18), rgba(234,88,12,0.10))", border: "1px solid rgba(249,115,22,0.4)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="bg-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">NAJBOLJI POGODAK</span>
                      <span className="text-[9px] font-medium text-orange-300/80">match score 98%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center text-white font-black text-lg flex-shrink-0">M</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm">Marko Milošević</span>
                          <span className="text-[9px] font-black text-white bg-orange-500 px-1.5 py-0.5 rounded">GOLD</span>
                        </div>
                        <div className="text-xs text-neutral-400 mt-0.5">98 skor · 127 smena · 4.9★</div>
                      </div>
                      <button className="bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors">Pošalji ponudu</button>
                    </div>
                    <div className="mt-3 pt-3 flex flex-wrap gap-1.5" style={{ borderTop: "1px solid rgba(249,115,22,0.2)" }}>
                      {["Sanitarna ✓", "Somelijer ✓", "Engleski B2 ✓", "100% pouzdanost"].map(tag => (
                        <span key={tag} className="text-[9px] font-semibold text-orange-300 bg-orange-500/15 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </div>
                  {[
                    { init: "JN", name: "Jovana N.", tier: "SILVER", score: "87 skor · 64 smene · 4.7★" },
                    { init: "SP", name: "Stefan P.", tier: "SILVER", score: "82 skor · 41 smena · 4.6★" },
                  ].map(c => (
                    <div key={c.init} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">{c.init}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-200 font-semibold text-xs">{c.name}</span>
                          <span className="text-[8px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">{c.tier}</span>
                        </div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">{c.score}</div>
                      </div>
                      <button className="text-neutral-400 hover:text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>Profil</button>
                    </div>
                  ))}
                  <div className="text-[10px] text-neutral-500 text-center pt-2">+ 14 dodatnih kandidata u Bronze tieru</div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 rounded-2xl px-4 py-2.5 shadow-lg" style={{ background: "white" }}>
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3L13 13M13 3L3 13" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" /></svg>
                  <div>
                    <div className="text-[11px] font-bold text-neutral-800">Bez CV-a</div>
                    <div className="text-[9px] text-neutral-400">bez razgovora</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="max-w-4xl mx-auto px-6 py-24">
        <div className="text-center mb-12">
          <span className="inline-block bg-orange-50 border border-orange-100 text-orange-500 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">FAQ</span>
          <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">Pitanja o Passport™ sistemu</h2>
        </div>
        <FAQAccordion items={faqItems} />
      </section>

      {/* ── FINAL CTA ── */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="rounded-[36px] p-10 sm:p-14 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "repeating-linear-gradient(45deg, white 0px, white 1px, transparent 1px, transparent 32px)" }} />
          <div className="relative grid sm:grid-cols-[1.4fr_1fr] gap-8 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-[1.15]">Tvoj Passport te čeka.</h2>
              <p className="text-white/85 font-light text-base mt-3 max-w-md">5 minuta da popuniš osnovne podatke. Sve ostalo gradiš svakom smenom — bez napora.</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-end gap-3">
              <Link href="/register" className="bg-white text-orange-600 hover:bg-orange-50 transition-colors font-bold text-sm px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 whitespace-nowrap">
                Napravi Passport™
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
              <Link href="/waiter" className="bg-orange-700/40 hover:bg-orange-700/60 transition-colors text-white font-semibold text-sm px-6 py-3.5 rounded-2xl border border-white/20 text-center whitespace-nowrap">Pregledaj demo</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-neutral-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="logo-mark w-8 h-8 rounded-xl flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M10 3C7 3 4.5 5.5 4.5 8.5C4.5 12.5 10 18 10 18C10 18 15.5 12.5 15.5 8.5C15.5 5.5 13 3 10 3Z" fill="white" opacity="0.95" /><circle cx="10" cy="8.5" r="2.2" fill="white" /></svg>
            </div>
            <span className="text-sm font-bold text-neutral-700">eKonobar</span>
            <span className="text-xs text-neutral-400">© 2026 — Beograd</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-neutral-500 font-medium">
            <Link href="/" className="hover:text-orange-500 transition-colors">Početna</Link>
            <Link href="/for-waiters" className="hover:text-orange-500 transition-colors">Passport™</Link>
            <Link href="/for-venues" className="hover:text-orange-500 transition-colors">Za lokale</Link>
            <Link href="/login" className="hover:text-orange-500 transition-colors">Prijava</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
