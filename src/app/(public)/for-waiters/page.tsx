"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FAQAccordion } from "@/components/ui/FAQAccordion";
import { PassportProCTA } from "@/components/ui/PassportProCTA";
import { FeatureGrid } from "@/components/ui/FeatureGrid";
import { CheckIcon } from "@/components/ui/CheckIcon";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { NAV_LINKS, FOOTER_LINKS, HERO_STATS, WAITER_FEATURES, faqItems } from "./content";

// Real, public job map — the same MapSearch the app uses. Loaded client-side
// (mapbox-gl is browser-only). Renders a token-missing fallback until configured.
const MapSearch = dynamic(() => import("@/components/map/MapSearch"), { ssr: false });

export default function ForWaitersPage() {
  return (
    <div className="hero-bg min-h-screen">

      {/* ── NAV ── */}
      <LandingNav
        links={NAV_LINKS}
        cta={{ href: "/register", label: "Registracija" }}
      />

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
                  <CheckIcon />
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link href="/register" className="btn-primary text-white font-bold text-base px-8 py-4 rounded-2xl flex items-center gap-2.5">
                Napravi svoj Passport™
                <ArrowRight size={16} strokeWidth={2} />
              </Link>
              <Link href="#mogucnosti" className="btn-secondary font-semibold text-base px-8 py-4 rounded-2xl flex items-center gap-2.5">Vidi kako radi</Link>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-neutral-200/60 max-w-lg">
              {HERO_STATS.map((s, i) => (
                <div key={s.label} className={i === 0 ? "" : "border-l border-neutral-200/60 pl-6"}>
                  <div className="font-extrabold text-2xl text-neutral-900">{s.value}</div>
                  <div className="text-[11px] text-neutral-400 font-medium mt-0.5">{s.label}</div>
                </div>
              ))}
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

      {/* ── MOGUĆNOSTI (feature overview) ── */}
      <FeatureGrid
        id="mogucnosti"
        kicker="Šta dobiješ"
        heading={<>Sve što ti Passport <span className="text-orange-500">daje</span>.</>}
        sub="Jedan profil koji te prati kroz svaku smenu — verifikovan, transparentan, i u potpunosti besplatan."
        tiles={WAITER_FEATURES}
      />

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
                <ArrowRight size={14} strokeWidth={2} />
              </Link>
              <Link href="/waiter" className="bg-orange-700/40 hover:bg-orange-700/60 transition-colors text-white font-semibold text-sm px-6 py-3.5 rounded-2xl border border-white/20 text-center whitespace-nowrap">Pregledaj demo</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <LandingFooter links={FOOTER_LINKS} />
    </div>
  );
}
