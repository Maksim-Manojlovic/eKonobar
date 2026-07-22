"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { FAQAccordion, type FAQItem } from "@/components/ui/FAQAccordion";
import { NavAuthButton } from "@/components/ui/NavAuthButton";
import { PassportProCTA } from "@/components/ui/PassportProCTA";
import { FlagSwitcher } from "@/components/ui/FlagSwitcher";

// Real, public job map — the same MapSearch the app uses. Loaded client-side
// (mapbox-gl is browser-only). Renders a token-missing fallback until configured.
const MapSearch = dynamic(() => import("@/components/map/MapSearch"), { ssr: false });

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
        Da. Passport je vezan za tebe, ne za grad. Trenutno radimo u Beogradu, Novom Sadu i Nišu — Zagreb stiže u Q3 2026. Skor, verifikacija i sve recenzije se prenose, ne resetuju.
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
    question: "Mogu li sakriti nizak skor od poslodavca?",
    answer: (
      <>
        Ne — to je suština sistema. Ali nizak skor na početku{" "}
        <strong className="font-semibold text-neutral-700">nije rupa</strong>; svi smo počeli odatle. Lokali koji traže iskusne ljude filtriraju po skoru, ali ima podosta otvorenih ka početnicima.
      </>
    ),
  },
  {
    question: "Da li skor opada ako mesec dana ne radim?",
    answer: (
      <>
        Skor ne opada zbog pauze — broj smena i recenzije ostaju. Ali aktivnost u poslednjih 90 dana{" "}
        <strong className="font-semibold text-neutral-700">poboljšava prioritet</strong> u algoritmu preporuke. Ako planiraš pauzu, postaviš status „nedostupan&rdquo; i ne kvariš statistiku.
      </>
    ),
  },
  {
    question: "Koliko košta Passport?",
    answer: (
      <>
        Za konobare je <strong className="font-semibold text-neutral-700">besplatan u celosti</strong> — profil, verifikacija, recenzije, geofenced smene, web push, WhatsApp i SMS notifikacije. Nema pretplate i nema pozicije u pretrazi koja se može kupiti; rangira te skor koji si zaradio. Vlasnici lokala plaćaju samo proviziju pri angažmanu.
      </>
    ),
  },
  {
    question: "Mogu li da tražim godišnji odmor preko aplikacije?",
    answer: (
      <>
        Da — ako radiš u stalnoj ekipi lokala. Pošalješ zahtev iz aplikacije, vidiš{" "}
        <strong className="font-semibold text-neutral-700">svoj balans dana</strong> i status u realnom vremenu. Ako zahtev prođe pravila lokala (dovoljno najave, slobodan kapacitet, van blackout dana) — <strong className="font-semibold text-neutral-700">auto-odobrava se</strong>, bez čekanja. Bolovanje se vodi zasebno i ne troši godišnji. Isto tako možeš da zameniš smenu sa kolegom ili uzmeš otvorenu smenu na mapi.
      </>
    ),
  },
];

const NAV_LINKS = [
  { href: "#kako-radi", label: "Passport™" },
  { href: "#verifikacija", label: "Verifikacija" },
  { href: "#smene",     label: "Smene i odmori" },
  { href: "#faq",       label: "FAQ"        },
];

export default function ForWaitersPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="hero-bg min-h-screen">

      {/* ── NAV ── */}
      <nav className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between relative">
        <Link href="/" className="flex items-center gap-3">
          <LogoMark />
          <span className="font-bold text-xl tracking-tight text-gray-900">eKonobar</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} className="hover:text-neutral-800 transition-colors">{l.label}</a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <FlagSwitcher />
          <NavAuthButton />
          <Link href="/register" className="hidden sm:block btn-primary text-white text-sm font-semibold px-5 py-2.5 rounded-2xl">Registracija</Link>
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="md:hidden flex flex-col gap-1.5 p-2 rounded-xl hover:bg-neutral-100 transition-colors"
            aria-label="Meni"
          >
            {mobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 4L16 16M16 4L4 16" stroke="#374151" strokeWidth="2" strokeLinecap="round" /></svg>
            ) : (
              <>
                <span className="w-5 h-0.5 bg-neutral-700 rounded-full" />
                <span className="w-5 h-0.5 bg-neutral-700 rounded-full" />
                <span className="w-4 h-0.5 bg-neutral-700 rounded-full self-end" />
              </>
            )}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 mx-4 bg-white rounded-2xl shadow-lg border border-neutral-100 overflow-hidden z-50">
            {NAV_LINKS.map(l => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center px-5 py-3.5 text-sm font-medium text-neutral-700 hover:bg-orange-50 hover:text-orange-600 transition-colors border-b border-neutral-50 last:border-0"
              >
                {l.label}
              </a>
            ))}
            <div className="p-3">
              <Link
                href="/register"
                onClick={() => setMobileOpen(false)}
                className="btn-primary w-full text-white text-sm font-semibold py-3 rounded-xl text-center block"
              >
                Registracija
              </Link>
            </div>
          </div>
        )}
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
                <>Skor 0–100 iz stvarnih recenzija <strong className="font-semibold text-neutral-800">otvara bolje pozicije</strong> i veće zarade — i ne može se kupiti.</>,
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
                    <span className="text-white text-xs font-bold tracking-tight">Verifikovan</span>
                  </div>
                  <span className="text-orange-400 text-[10px] font-semibold">Skor 84 / 100</span>
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

      {/* ── ŽIVA MAPA POSLOVA ── */}
      <section id="mapa" className="max-w-7xl mx-auto px-6 py-24">
        <div className="max-w-2xl mb-14">
          <span className="inline-block bg-orange-50 border border-orange-100 text-orange-500 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">Uživo</span>
          <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">
            Poslovi na <span className="text-orange-500">mapi</span>, u realnom vremenu.
          </h2>
          <p className="mt-4 text-lg text-neutral-500 font-light leading-relaxed">
            Ovo je prava mapa iz aplikacije — pomeraj, zumiraj, filtriraj po tipu. Vidi gde ima posla pre nego što se registruješ.
          </p>
        </div>

        <MapSearch mode="jobs" />

        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 rounded-2xl bg-orange-50 border border-orange-100 px-5 py-4">
          <p className="text-sm text-neutral-700 font-medium flex-1 text-center sm:text-left">
            Da konkurišeš na oglas i vidiš pun profil lokala — napravi nalog. Besplatno.
          </p>
          <Link href="/register?role=WAITER" className="btn-primary text-white font-bold px-6 py-2.5 rounded-xl text-sm whitespace-nowrap">
            Napravi Passport →
          </Link>
        </div>
      </section>

      <div className="section-divider max-w-7xl mx-auto" />

      {/* ── SMENE I ODMORI (waiter side) ── */}
      <section id="smene" className="max-w-7xl mx-auto px-6 py-24">
        <div className="max-w-2xl mb-14">
          <span className="inline-flex items-center gap-2 bg-orange-50 border border-orange-100 text-orange-500 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">
            <span className="bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded">NOVO</span>
            Smene i odmori
          </span>
          <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">
            Tvoja smena, tvoj <span className="text-orange-500">godišnji</span> — sve iz aplikacije.
          </h2>
          <p className="mt-4 text-lg text-neutral-500 font-light leading-relaxed">
            Kad radiš u stalnoj ekipi lokala, ne moraš da moliš za slobodan dan usmeno. Godišnji, zamene i otvorene smene — sve na telefonu, transparentno.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              num: "01",
              title: "Godišnji iz aplikacije",
              desc: "Pošalji zahtev, vidi svoj balans dana i status odmah. Kad prođe pravila lokala — auto-odobreno. Bez papira i „pitaj šefa u hodu“.",
            },
            {
              num: "02",
              title: "Zameni smenu",
              desc: "Ne možeš da dođeš? Pošalji zamenu kolegi kroz aplikaciju; vlasnik potvrdi. Bez grupnih poruka i muke oko pokrivanja.",
            },
            {
              num: "03",
              title: "Uzmi otvorenu smenu",
              desc: "Lokali objavljuju slobodne smene na mapi. Uzmeš jednim klikom, GPS check-in potvrdi dolazak — dodatna zarada kad ti odgovara.",
              dark: true,
            },
          ].map((card) => (
            card.dark ? (
              <div key={card.num} className="rounded-3xl p-7 relative overflow-hidden"
                style={{ background: "linear-gradient(160deg, #1c1209 0%, #2a1a08 100%)", border: "1px solid rgba(249,115,22,0.25)" }}>
                <div className="flex items-start justify-between mb-5 relative z-10">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(249,115,22,0.18)", border: "1px solid rgba(249,115,22,0.3)" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" stroke="#f97316" strokeWidth="2" strokeLinejoin="round"/><circle cx="12" cy="9" r="2.5" fill="#f97316"/></svg>
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
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="#f97316" strokeWidth="1.8"/><path d="M3 10h18M8 2v4M16 2v4M9 15l2 2 4-4" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full tracking-wider">{card.num}</span>
                </div>
                <h3 className="font-bold text-lg text-neutral-900 mb-2">{card.title}</h3>
                <p className="text-sm text-neutral-500 font-light leading-relaxed">{card.desc}</p>
              </div>
            )
          ))}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 rounded-2xl bg-orange-50 border border-orange-100 px-5 py-4">
          <p className="text-sm text-neutral-700 font-medium flex-1 text-center sm:text-left">
            Držiš se rasporeda? <span className="font-bold text-neutral-900">Pouzdanost raste</span> — i tvoj Passport™ skor s njom.
          </p>
          <Link href="/register?role=WAITER" className="btn-primary text-white font-bold px-6 py-2.5 rounded-xl text-sm whitespace-nowrap">
            Napravi Passport →
          </Link>
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
            { num: "06", title: "Skor 0–100", desc: "Bayesov algoritam kombinuje sve gore navedeno u jedan broj. Viši skor = prednost na konkurenciji. Ne kupuje se — zarađuje se.", dark: true },
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

      {/* ── VERIFICATION ── */}
      <section id="verifikacija" className="relative py-24 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #fafaf8 0%, #f5f1ec 100%)" }} />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-14">
            <div>
              <span className="inline-block bg-orange-50 border border-orange-100 text-orange-500 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">Verifikacija</span>
              <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">
                Sve besplatno.<br /><span className="text-orange-500">Plaćaš samo dokazom.</span>
              </h2>
            </div>
            <p className="text-base text-neutral-500 font-light leading-relaxed max-w-md">
              Nema paketa, nema pretplate, nema pozicija koje se kupuju. Vlasnik te rangira po skoru koji si zaradio i po tome šta si stvarno potvrdio.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                kicker: "Ko si",
                title: "Identitet",
                desc: "Ličnom kartom potvrđuješ da si ti. Jedan profil po osobi — nema lažnih duplikata, a tvoje ocene nose veću težinu.",
                items: ["Lična karta (JMBG se čuva samo kao hash)", "Ugovor o radu potvrđen", "Invite kod od lokala u kom radiš"],
              },
              {
                kicker: "Šta znaš",
                title: "Dokumenti i veštine",
                desc: "Sanitarna, somelijer, jezici, HACCP. Uploaduješ jednom, eKonobar verifikuje, koristiš svuda.",
                items: ["Sanitarna knjižica sa rokom važenja", "Sertifikati i kursevi", "Jezici i specijalnosti"],
              },
              {
                kicker: "Kako radiš",
                title: "Skor 0–100",
                desc: "Jedan broj iz stvarnih recenzija vlasnika i gostiju. Raste kad radiš dobro, pada kad ne. Ne može se kupiti.",
                items: ["Geofenced istorija smena", "Recenzije koje niko ne može obrisati", "Pouzdanost — nedolasci i kašnjenja"],
              },
            ].map((card, i) => (
              <div
                key={card.title}
                className={`rounded-3xl p-7 flex flex-col ${i === 2 ? "" : "bg-white border border-neutral-100"}`}
                style={i === 2 ? { background: "linear-gradient(160deg, #1c1209 0%, #2a1a08 100%)", border: "1px solid rgba(249,115,22,0.3)" } : undefined}
              >
                <div className="mb-5">
                  <div className={`text-[10px] font-black tracking-[0.2em] uppercase mb-2 ${i === 2 ? "text-orange-400" : "text-neutral-400"}`}>{card.kicker}</div>
                  <h3 className={`font-extrabold text-xl ${i === 2 ? "text-white" : "text-neutral-900"}`}>{card.title}</h3>
                  <p className={`text-sm font-light leading-relaxed mt-2 ${i === 2 ? "text-neutral-300" : "text-neutral-500"}`}>{card.desc}</p>
                </div>
                <ul className={`flex flex-col gap-2.5 text-sm flex-1 ${i === 2 ? "text-neutral-300" : "text-neutral-600"}`}>
                  {card.items.map(item => (
                    <li key={item} className="flex gap-2.5 items-start">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 mt-0.5">
                        <circle cx="7" cy="7" r="6" fill={i === 2 ? "rgba(249,115,22,0.2)" : "#fff1e7"} />
                        <path d="M4 7L6.5 9.5L10 5" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="max-w-md mx-auto mt-10">
            <PassportProCTA label="Napravi Passport besplatno" className="block text-center btn-primary text-white font-bold text-sm py-3.5 rounded-xl" />
          </div>
          <p className="text-center text-xs text-neutral-400 mt-4">
            Bez kartice, bez pretplate. Registracija traje minut.
          </p>
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
                  { n: "1", title: "Vlasnik filtrira po Passport™ kriterijumima", desc: "Skor, verifikacija, lokacija, dostupnost, sertifikati. Vidi samo relevantne profile." },
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
                      Filter: Verifikovan, Sanitarna, Engleski
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
                          <span className="text-[9px] font-black text-white bg-green-600 px-1.5 py-0.5 rounded">✓ VERIFIKOVAN</span>
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
                    { init: "JN", name: "Jovana N.", tier: "✓ VERIFIKOVAN", score: "87 skor · 64 smene · 4.7★" },
                    { init: "SP", name: "Stefan P.", tier: "✓ VERIFIKOVAN", score: "82 skor · 41 smena · 4.6★" },
                  ].map(c => (
                    <div key={c.init} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">{c.init}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-200 font-semibold text-xs">{c.name}</span>
                          <span className="text-[8px] font-black text-green-700 bg-green-100 px-1.5 py-0.5 rounded">{c.tier}</span>
                        </div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">{c.score}</div>
                      </div>
                      <button className="text-neutral-400 hover:text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>Profil</button>
                    </div>
                  ))}
                  <div className="text-[10px] text-neutral-500 text-center pt-2">+ 14 dodatnih kandidata sa nižim skorom</div>
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

      {/* ── TESTIMONIALS ── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block bg-orange-50 border border-orange-100 text-orange-500 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">Konobare pričaju</span>
          <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">Šta kažu kolege koji već koriste Passport™</h2>
        </div>
        <div className="grid lg:grid-cols-3 gap-5">
          {[
            { q: "Za dva meseca sam podigao skor sa 48 na 76. Sad me lokali nalaze — ne moram više da šaljem CV svuda. Jednostavno radi.", name: "Aleksandar D.", city: "Konobar · Beograd, Savamala", init: "AD", tier: "76 skor" },
            { q: "Red Alert notifikacija mi je stigla na WhatsApp dok sam bio na putu. Javio sam se prvi i bio potvrđen za 3 minuta. Bez tog sistema nikad ne bih saznao.", name: "Jelena M.", city: "Šanker · Novi Sad", init: "JM", tier: "91 skor" },
            { q: "Imam 5 godina iskustva ali nikad nisam imao ništa da pokažem. Passport je to rešio — vlasnik vidi 67 smena i 4.8★ odmah pri prvom kontaktu.", name: "Nikola S.", city: "Konobar · Beograd, Stari Grad", init: "NS", tier: "88 skor" },
          ].map(t => (
            <div key={t.init} className="bg-white rounded-3xl p-7 border border-neutral-100 flex flex-col">
              <div className="flex items-center gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} width="14" height="14" viewBox="0 0 10 10" fill="#f97316"><path d="M5 1L6.18 3.42L9 3.82L7 5.77L7.49 8.58L5 7.24L2.51 8.58L3 5.77L1 3.82L3.82 3.42L5 1Z" /></svg>
                ))}
              </div>
              <p className="text-base text-neutral-700 font-light leading-relaxed flex-1">&ldquo;{t.q}&rdquo;</p>
              <div className="mt-6 pt-5 border-t border-neutral-100 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center text-white font-black">{t.init}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-neutral-900">{t.name}</div>
                  <div className="text-xs text-neutral-400">{t.city}</div>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200 flex-shrink-0">{t.tier}</span>
              </div>
            </div>
          ))}
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
