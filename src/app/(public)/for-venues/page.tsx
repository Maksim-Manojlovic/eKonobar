"use client";

import { useState } from "react";
import Link from "next/link";
import { FAQAccordion, type FAQItem } from "@/components/ui/FAQAccordion";
import { NavAuthButton } from "@/components/ui/NavAuthButton";
import { FlagSwitcher } from "@/components/ui/FlagSwitcher";

const LogoMark = () => (
  <div className="logo-mark w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 3C7 3 4.5 5.5 4.5 8.5C4.5 12.5 10 18 10 18C10 18 15.5 12.5 15.5 8.5C15.5 5.5 13 3 10 3Z" fill="white" opacity="0.95" />
      <circle cx="10" cy="8.5" r="2.2" fill="white" />
    </svg>
  </div>
);

const CheckOrange = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
    <circle cx="8" cy="8" r="7" fill="#fed7aa" />
    <path d="M5 8L7 10L11 6" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const faqItems: FAQItem[] = [
  {
    question: "Šta ako konobar ne dođe na smenu?",
    answer: (
      <>
        <strong className="font-semibold text-neutral-700">Ne plaćaš ništa</strong> — provizija se naplaćuje samo na verifikovano odrađenu smenu. Sistem automatski aktivira{" "}
        <strong className="font-semibold text-neutral-700">Red Alert™ rezervu</strong>: ako konobar ne potvrdi check-in 30 minuta pre smene, oglas ide ponovo. Pouzdanost u Passport-u tog konobara pada — što ga isključuje iz tvog filtera u budućnosti.
      </>
    ),
  },
  {
    question: "Da li je ovo radni odnos? Imam li obavezu poreza/doprinosa?",
    answer: (
      <>
        eKonobar generiše <strong className="font-semibold text-neutral-700">ugovor o privremenim i povremenim poslovima</strong> (omladinska/studentska zadruga ili honorarni rad — biraš model). Sve poreske obaveze obračunava i prijavljuje sistem. Ti dobijaš jednu fakturu mesečno sa obračunom za svaku smenu.
      </>
    ),
  },
  {
    question: "Mogu li da odbijem konobara koji se prijavi?",
    answer: (
      <>
        Naravno. Vidiš sve prijave, biraš koga god hoćeš (ili nikog) — bez obrazloženja, bez kazne. Ako želiš, postaviš filter (Gold+, sanitarna, jezik) — sistem te i ne uznemirava sa kandidatima koji ga ne ispunjavaju.
      </>
    ),
  },
  {
    question: "Šta sa konobarima koje već imam — mogu li ih dodati u sistem?",
    answer: (
      <>
        Da. Pošalješ pozivnicu — oni naprave Passport za 5 minuta i postaju deo{" "}
        <strong className="font-semibold text-neutral-700">&quot;Tvog tima&quot;</strong>. Sledeću smenu prvo vide oni, pa tek onda ide na otvoreno tržište. Ako ne odgovaraju u roku od sat vremena, sistem je automatski objavljuje šire.
      </>
    ),
  },
  {
    question: "Šta ako konobar napiše negativnu recenziju o mom lokalu?",
    answer: (
      <>
        Sistem je <strong className="font-semibold text-neutral-700">obostran i transparentan</strong> — gradiš reputaciju kao dobar poslodavac (uredne smene, plaćanje na vreme, atmosfera). Imaš 14 dana za prigovor; nepravedne ocene moderira naš tim. Lokali sa visokom ocenom dobijaju oznaku &quot;Top poslodavac&quot; — i prioritet kod najboljih konobara.
      </>
    ),
  },
  {
    question: "Kako tačno funkcioniše plaćanje?",
    answer: (
      <>
        Kada potvrdiš ponudu, iznos plate ide u <strong className="font-semibold text-neutral-700">escrow</strong> (zaštićen na našem računu). Kad sistem verifikuje da je smena završena, novac se prebacuje konobaru u roku od 24h. Ti dobijaš jednu zbirnu fakturu na kraju meseca — provizija + isplate, sa PDV-om.
      </>
    ),
  },
];

const venues = ["Salon 1905", "Freestyler", "Manufaktura", "Bar Central", "Kafana Skadarlija", "Bar Mixer", "Kafeterija Dok", "Klub 20/44"];

const NAV_LINKS_VENUE = [
  { href: "#kako-radi", label: "Kako funkcioniše" },
  { href: "#cenovnik",  label: "Cenovnik"         },
  { href: "#faq",       label: "FAQ"               },
];

export default function ForVenuesPage() {
  const [submitted,   setSubmitted]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);

  return (
    <div className="page-bg min-h-screen">

      {/* ── NAV ── */}
      <nav className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between relative">
        <Link href="/" className="flex items-center gap-3">
          <LogoMark />
          <span className="font-bold text-xl tracking-tight text-gray-900">eKonobar</span>
          <span className="hidden lg:inline-block whitespace-nowrap text-[10px] font-bold tracking-[0.18em] uppercase text-orange-500 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full ml-1">za vlasnike</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
          {NAV_LINKS_VENUE.map(l => (
            <a key={l.href} href={l.href} className="hover:text-neutral-800 transition-colors">{l.label}</a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <FlagSwitcher />
          <NavAuthButton />
          <Link href="#demo" className="hidden sm:block btn-primary text-white text-sm font-semibold px-5 py-2.5 rounded-2xl">Zakaži demo</Link>
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
            {NAV_LINKS_VENUE.map(l => (
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
              <a
                href="#demo"
                onClick={() => setMobileOpen(false)}
                className="btn-primary w-full text-white text-sm font-semibold py-3 rounded-xl text-center block"
              >
                Zakaži demo
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="max-w-7xl mx-auto px-6 pt-14 pb-20">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-14 items-center">

          {/* LEFT */}
          <div className="flex flex-col gap-7">
            <div className="inline-flex items-center gap-2 self-start">
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-orange-500">Za vlasnike lokala</span>
              <span className="w-8 h-px bg-orange-200" />
              <span className="text-[11px] font-medium tracking-wider uppercase text-neutral-400">Beograd · Novi Sad · Niš</span>
            </div>

            <h1 className="text-5xl xl:text-[60px] font-extrabold text-neutral-900 leading-[1.05] tracking-tight">
              Popunite smenu za<br /><span className="text-orange-500">15 minuta</span> —<br />
              <span className="text-neutral-500 font-semibold">provereni ugostitelji<br />na klik.</span>
            </h1>

            <p className="text-lg text-neutral-500 font-light leading-relaxed max-w-xl">
              Pronađite iskusne konobare i šankere u Beogradu. Bez agencija i beskrajnih poziva —{" "}
              <strong className="font-semibold text-neutral-700">plaćate samo odrađenu smenu. Hitna zamena osoblja za 12 minuta.</strong>
            </p>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-1">
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-2">
                  {["bg-orange-200", "bg-orange-300", "bg-orange-400"].map(c => (
                    <div key={c} className={`w-7 h-7 rounded-full ${c} border-2 border-white`} />
                  ))}
                </div>
                <span className="text-xs text-neutral-600"><strong className="font-bold text-neutral-900">500+ lokala</strong> u Beogradu već koristi</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <CheckOrange />
                <span>0 RSD dok ne popuniš prvu smenu</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link href="#demo" className="btn-primary text-white font-bold text-base px-8 py-4 rounded-2xl flex items-center gap-2.5">
                Zakaži demo (20 min)
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M9 4L13 8L9 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
              <Link href="/register?role=venue" className="btn-secondary font-semibold text-base px-8 py-4 rounded-2xl flex items-center gap-2.5">Postavi prvi oglas</Link>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-neutral-200/70 max-w-lg">
              <div className="stat">
                <div className="font-extrabold text-3xl text-neutral-900">15<span className="text-base text-neutral-400 font-bold">min</span></div>
                <div className="text-[11px] text-neutral-400 font-medium mt-0.5">prosečno do prve prijave</div>
              </div>
              <div className="stat border-l border-neutral-200/70 pl-6">
                <div className="font-extrabold text-3xl text-neutral-900">↓68<span className="text-base text-neutral-400 font-bold">%</span></div>
                <div className="text-[11px] text-neutral-400 font-medium mt-0.5">no-show stopa</div>
              </div>
              <div className="stat border-l border-neutral-200/70 pl-6">
                <div className="font-extrabold text-3xl text-neutral-900">+24<span className="text-base text-neutral-400 font-bold">%</span></div>
                <div className="text-[11px] text-neutral-400 font-medium mt-0.5">prosečna ocena gosta</div>
              </div>
            </div>
          </div>

          {/* RIGHT — dashboard mockup */}
          <div className="relative">
            <div className="absolute w-80 h-80 rounded-full opacity-20 -top-10 right-0" style={{ background: "radial-gradient(circle, #f97316, transparent 70%)", filter: "blur(48px)" }} />
            <div className="relative bg-white rounded-3xl overflow-hidden shadow-2xl float-card border border-neutral-100">
              <div className="px-5 py-3.5 flex items-center gap-3 border-b border-neutral-100">
                <div className="flex gap-1.5">
                  {[...Array(3)].map((_, i) => <div key={i} className="w-2.5 h-2.5 rounded-full bg-neutral-200" />)}
                </div>
                <div className="flex-1 text-center text-[10px] font-mono text-neutral-400">salon-1905 · vlasnik dashboard</div>
                <div className="flex items-center gap-1.5 text-[10px] text-orange-500 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 blink" />LIVE
                </div>
              </div>
              <div className="px-6 py-5 flex items-center justify-between border-b border-neutral-100">
                <div>
                  <div className="text-[10px] tracking-widest text-neutral-400 font-bold uppercase">Otvoreni oglas</div>
                  <div className="font-extrabold text-neutral-900 text-base mt-1">Konobar · Večernja smena · 02.05</div>
                  <div className="text-xs text-neutral-400 mt-0.5">18:00 – 24:00 · 3.500 RSD · Salon 1905</div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-3xl text-orange-500">14</div>
                  <div className="text-[10px] text-neutral-400 font-medium">prijava (5 min)</div>
                </div>
              </div>
              <div className="p-5 flex flex-col gap-3" style={{ background: "#fafaf8" }}>
                <div className="text-[10px] tracking-widest text-neutral-400 font-bold uppercase mb-1">Top kandidati po Passport™ skoru</div>
                <div className="bg-white rounded-2xl p-4 border border-orange-200 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center text-white font-black text-base flex-shrink-0">M</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-neutral-900">Marko Milošević</span>
                        <span className="tier-pill bg-orange-500 text-white">GOLD</span>
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">98 skor · 127 smena · 4.9★ · 100% pouzdan</div>
                    </div>
                    <button className="bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold px-3 py-2 rounded-lg transition-colors flex-shrink-0">Pošalji ponudu</button>
                  </div>
                  <div className="mt-3 pt-3 border-t border-neutral-100 flex flex-wrap gap-1.5">
                    {["Sanitarna ✓", "Somelijer ✓", "Engleski B2 ✓", "Radio kod tebe (3×)"].map(t => (
                      <span key={t} className="text-[9px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
                {[
                  { init: "JN", name: "Jovana N.", tier: "SILVER", score: "87 skor · 64 smene · 4.7★" },
                  { init: "SP", name: "Stefan P.", tier: "SILVER", score: "82 skor · 41 smena · 4.6★" },
                ].map(c => (
                  <div key={c.init} className="bg-white rounded-2xl p-3.5 border border-neutral-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">{c.init}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-neutral-800">{c.name}</span>
                        <span className="tier-pill bg-amber-100 text-amber-700">{c.tier}</span>
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">{c.score}</div>
                    </div>
                    <button className="text-neutral-500 hover:text-orange-500 text-[10px] font-semibold px-3 py-1.5 rounded-lg border border-neutral-200">Profil</button>
                  </div>
                ))}
                <div className="text-[10px] text-neutral-400 text-center pt-1">+ 11 dodatnih kandidata</div>
              </div>
            </div>
            <div className="absolute -left-6 top-32 hidden lg:flex bg-white rounded-2xl px-4 py-3 shadow-xl items-center gap-3 border border-neutral-100">
              <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1C5.79 1 4 2.79 4 5V8L2 10H14L12 8V5C12 2.79 10.21 1 8 1Z" stroke="#f97316" strokeWidth="1.5" fill="#fed7aa" /></svg>
              </div>
              <div>
                <div className="text-[11px] font-bold text-neutral-800">Marko prihvatio</div>
                <div className="text-[10px] text-neutral-400">5 sekundi pre · GPS check-in zakazan</div>
              </div>
            </div>
          </div>
        </div>

        {/* Marquee */}
        <div className="mt-20 pt-10 border-t border-neutral-200/70">
          <div className="text-center text-[11px] tracking-[0.2em] uppercase font-bold text-neutral-400 mb-6">Lokali koji nam veruju</div>
          <div className="overflow-hidden relative" style={{ maskImage: "linear-gradient(90deg, transparent, black 10%, black 90%, transparent)" }}>
            <div className="marquee-track flex gap-12 whitespace-nowrap">
              {[...venues, ...venues].map((v, i) => (
                <span key={i} className="text-2xl font-extrabold text-neutral-300 tracking-tight">{v}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="max-w-3xl mb-14">
          <span className="inline-block bg-orange-50 border border-orange-100 text-orange-500 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">Zašto eKonobar</span>
          <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">
            Tri razloga zašto <span className="text-orange-500">500+ lokala</span> bira eKonobar.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-8 border border-neutral-100 flex flex-col gap-5">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <span className="text-[10px] font-black tracking-widest uppercase text-orange-500">Brzina</span>
              <h3 className="font-bold text-xl text-neutral-900 mt-1 leading-tight">Smena je puna pre nego što kafa stigne.</h3>
            </div>
            <p className="text-sm text-neutral-500 font-light leading-relaxed">Prosečno vreme do prve prijave konobara je <strong className="font-semibold text-neutral-700">12 minuta</strong>. Red Alert™ šalje push notifikaciju na 50+ konobara u krugu od 5 km — idealno za hitnu zamenu osoblja u Beogradu.</p>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-neutral-100 flex flex-col gap-5">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v7c0 5 4 9 9 10 5-1 9-5 9-10V7L12 2z" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <span className="text-[10px] font-black tracking-widest uppercase text-orange-500">Poverenje</span>
              <h3 className="font-bold text-xl text-neutral-900 mt-1 leading-tight">Svaki profil je verifikovan i ocenjen od strane kolega.</h3>
            </div>
            <p className="text-sm text-neutral-500 font-light leading-relaxed"><strong className="font-semibold text-neutral-700">Waiter Passport™</strong> prikazuje kompletnu istoriju smena, ocene svakog poslodavca i sertifikate — konobari Beograd, Novi Sad i Niš na jednom mestu. Verifikovano, ne samo prijavljeno.</p>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-neutral-100 flex flex-col gap-5">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6M9 13h6M9 17h4" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <span className="text-[10px] font-black tracking-widest uppercase text-orange-500">Bez administracije</span>
              <h3 className="font-bold text-xl text-neutral-900 mt-1 leading-tight">Mi brinemo o ugovorima, vi o gostima.</h3>
            </div>
            <p className="text-sm text-neutral-500 font-light leading-relaxed">Sistem automatski generiše <strong className="font-semibold text-neutral-700">ugovor o privremenim poslovima</strong>, proverava sanitarnu knjižicu i vodi evidenciju sati putem geofencing check-ina — bez Excel-a i gomile papira.</p>
          </div>
        </div>
      </section>

      {/* ── ROI (dark) ── */}
      <section className="relative py-28 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #1a1209 0%, #2d1a06 50%, #1c110a 100%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 60% at 20% 50%, rgba(249,115,22,0.18) 0%, transparent 55%), radial-gradient(ellipse 50% 70% at 80% 30%, rgba(234,88,12,0.12) 0%, transparent 55%)" }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 48px), repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 48px)" }} />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mb-16">
            <span className="inline-block bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">Brojevi koji znače novac</span>
            <h2 className="text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-[1.1]">
              Vodeća platforma za zapošljavanje u <span className="text-orange-400">ugostiteljstvu Srbije.</span>
            </h2>
            <p className="mt-5 text-lg text-neutral-400 font-light leading-relaxed">Podaci sa 87 lokala u Beogradu, prvih 6 meseci 2026.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Aktivnih ugostitelja", value: "10k+", unit: "", sub: "verifikovanih konobara i šankera" },
              { label: "Prosečno vreme popune", value: "12", unit: "min", sub: "od objave do potvrđene prijave" },
              { label: "Provizija po smeni", value: "5", unit: "–8%", sub: "vs 22–28% kod agencija" },
              { label: "Mesečna ušteda", value: "182k", unit: "RSD", sub: "prosek po lokalu (12+ smena/mes)", highlight: true },
            ].map(stat => (
              <div key={stat.label} className="rounded-3xl p-7 relative overflow-hidden"
                style={stat.highlight
                  ? { background: "linear-gradient(160deg, rgba(249,115,22,0.20), rgba(234,88,12,0.10))", border: "1px solid rgba(249,115,22,0.4)" }
                  : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}>
                <div className="text-[10px] font-bold tracking-widest uppercase text-orange-400 mb-3">{stat.label}</div>
                <div className="flex items-baseline gap-2">
                  <span className="font-extrabold text-5xl text-white">{stat.value}</span>
                  <span className={`text-lg font-bold ${stat.highlight ? "text-orange-300" : "text-neutral-400"}`}>{stat.unit}</span>
                </div>
                <div className={`text-xs font-light mt-1 ${stat.highlight ? "text-orange-200" : "text-neutral-500"}`}>{stat.sub}</div>
              </div>
            ))}
          </div>
          <div className="mt-12 max-w-3xl">
            <div className="text-3xl text-white font-light leading-relaxed">
              <span className="text-orange-400 text-5xl leading-none">&ldquo;</span>
              Pre eKonobara, smo trošili oko <strong className="font-bold">8 sati nedeljno</strong> samo na traženje zamena. Sad to radi sistem. Mi se bavimo lokalom.
              <span className="text-orange-400 text-5xl leading-none">&rdquo;</span>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-black">NK</div>
              <div>
                <div className="text-white font-bold text-sm">Nikola Kovačević</div>
                <div className="text-neutral-500 text-xs">Vlasnik · Salon 1905, Stari Grad</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── KAKO RADI ── */}
      <section id="kako-radi" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block bg-orange-50 border border-orange-100 text-orange-500 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">Kako radi</span>
          <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">Tri koraka. Pet minuta. Smena popunjena.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { n: "01", title: "Objavi", desc: "Unesi detalje smene i cenu. Za 90 sekundi.", items: ["Templati za standardne smene", "Filter po verifikaciji, oceni i sanitarnoj", "Invite direktno poznatim konobarima"] },
            { n: "02", title: "Izaberi", desc: "Pregledaj prijave i ocene kandidata — najbolji prvi.", items: ["Vidiš sve recenzije, ne kuratorisane", "Pouzdanost (no-show istorija)", "Kandidati koji su već radili kod tebe"] },
          ].map(step => (
            <div key={step.n} className="bg-white rounded-3xl p-7 border border-neutral-100 relative">
              <div className="text-7xl font-black text-orange-100 absolute top-4 right-6 select-none leading-none">{step.n}</div>
              <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center mb-5" style={{ boxShadow: "0 4px 16px rgba(249,115,22,0.32)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="white" strokeWidth="2.4" strokeLinecap="round" /></svg>
              </div>
              <h3 className="font-bold text-xl text-neutral-900 mb-2 relative z-10">{step.title}</h3>
              <p className="text-sm text-neutral-500 font-light leading-relaxed mb-5">{step.desc}</p>
              <div className="flex flex-col gap-2 text-xs text-neutral-600">
                {step.items.map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" /></svg>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="rounded-3xl p-7 relative overflow-hidden" style={{ background: "linear-gradient(160deg, #f97316, #ea580c)", boxShadow: "0 8px 32px rgba(249,115,22,0.32)" }}>
            <div className="text-7xl font-black text-white/15 absolute top-4 right-6 select-none leading-none">03</div>
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center mb-5">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 7" stroke="#f97316" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h3 className="font-bold text-xl text-white mb-2 relative z-10">Gotovo</h3>
            <p className="text-sm text-orange-100 font-light leading-relaxed mb-5">Smena je potvrđena. Ugovor generisan, vidimo se u lokalu.</p>
            <div className="flex flex-col gap-2 text-xs text-white/90">
              {["Ugovor o privremenim poslovima — auto", "Plaćanje preko platforme (escrow)", "Faktura sa PDV-om u inboxu"].map(item => (
                <div key={item} className="flex items-center gap-2">
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-12">
          <span className="inline-block bg-orange-50 border border-orange-100 text-orange-500 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">Poređenje</span>
          <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">eKonobar vs. ono što sad koristiš</h2>
        </div>
        <div className="bg-white rounded-3xl border border-neutral-100 overflow-hidden max-w-5xl mx-auto">
          <div className="cmp-row" style={{ background: "#fafaf8" }}>
            <div className="cmp-cell head"><span className="text-[10px] tracking-widest uppercase font-bold text-neutral-400">Šta vam treba</span></div>
            <div className="cmp-cell head text-center"><span className="text-xs font-bold text-neutral-500">Agencije</span></div>
            <div className="cmp-cell head text-center" style={{ background: "linear-gradient(180deg, rgba(249,115,22,0.10), rgba(249,115,22,0.04))" }}>
              <span className="text-xs font-extrabold text-orange-500">eKonobar</span>
            </div>
          </div>
          {[
            ["Vreme do popune smene", "2–4 sata", "↓ 11 minuta"],
            ["Provizija", "22–28%", "5–8%"],
            ["Vidiš istoriju kandidata", "Ne", "Pun Passport™ ✓"],
            ["Geofencing potvrda smene", "Ne", "5km radius ✓"],
            ["Automatska sanitarna provera", "Ne", "Da ✓"],
            ["Generisanje ugovora", "Ručno", "Auto, e-potpis ✓"],
            ["Cancel u poslednji čas (no-show)", "9–14%", "3.2%"],
            ["Plaćaš za neuspešno popunjenu smenu", "Da (pretplata)", "0 RSD ✓"],
          ].map(([label, agency, ek]) => (
            <div key={label} className="cmp-row">
              <div className="cmp-cell"><span className="font-medium text-neutral-700">{label}</span></div>
              <div className="cmp-cell text-center cmp-x">{agency}</div>
              <div className="cmp-cell text-center font-bold text-orange-500" style={{ background: "rgba(249,115,22,0.04)" }}>{ek}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-3 gap-5">
          {[
            { q: "Imam restoran 14 godina. Prvi alat koji je stvarno rešio problem zamena u sezoni — bez agencija i bez panike.", name: "Aleksandar Pavlović", venue: "Manufaktura · Zemun", init: "AP" },
            { q: "Passport sistem mi sve govori za 5 sekundi. Vidim da je čovek odradio 80 smena, sa 4.8★ — to je dovoljno. Nema dva razgovora unapred.", name: "Milica Jovanović", venue: "Bar Mixer · Stari Grad", init: "MJ" },
            { q: "Najlepša stvar — \"Tvoj tim\". 8 stalnih konobara koje uvek prvo pita sistem. Stalna ekipa, ali bez režima radnog odnosa i papirologije.", name: "Dušan Radović", venue: "Freestyler · Savamala", init: "DR" },
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
                <div>
                  <div className="font-bold text-sm text-neutral-900">{t.name}</div>
                  <div className="text-xs text-neutral-400">{t.venue}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="cenovnik" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block bg-orange-50 border border-orange-100 text-orange-500 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">Cenovnik</span>
          <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">Plaćaš samo <span className="text-orange-500">popunjene smene.</span></h2>
          <p className="mt-5 text-lg text-neutral-500 font-light leading-relaxed">Bez pretplate, bez setup fee-a, bez minimuma. Provizija ide samo na uspešno odrađenu smenu — verifikovanu geofencingom.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {/* Starter */}
          <div className="bg-white rounded-3xl p-7 border border-neutral-100 flex flex-col">
            <div className="text-[10px] tracking-widest uppercase font-bold text-neutral-400 mb-2">Starter</div>
            <h3 className="font-extrabold text-2xl text-neutral-900 mb-1">Mali lokal</h3>
            <p className="text-xs text-neutral-400 mb-6">Do 30 smena mesečno</p>
            <div className="flex items-baseline gap-1.5 mb-6"><span className="font-extrabold text-5xl text-neutral-900">8%</span><span className="text-sm text-neutral-400">/ smeni</span></div>
            <ul className="flex flex-col gap-2.5 text-sm text-neutral-600 font-light flex-1">
              {["Neograničeno oglasa", "Pristup verifikovanim konobarima", "Geofencing GPS check-in", "Pregled Passport™ profila", "Email podrška (24h)"].map(item => (
                <li key={item} className="check-row"><CheckOrange />{item}</li>
              ))}
            </ul>
            <Link href="/register?plan=starter" className="mt-7 btn-secondary font-semibold text-sm py-3 rounded-xl text-center">Pokreni besplatno</Link>
          </div>
          {/* Pro */}
          <div className="rounded-3xl p-7 flex flex-col relative overflow-hidden" style={{ background: "linear-gradient(160deg, #f97316, #ea580c)", boxShadow: "0 12px 40px rgba(249,115,22,0.32)" }}>
            <div className="absolute top-5 right-5 bg-white/20 border border-white/30 text-white text-[9px] font-black tracking-wider px-2.5 py-1 rounded-full">NAJPOPULARNIJI</div>
            <div className="text-[10px] tracking-widest uppercase font-bold text-orange-100 mb-2">Pro</div>
            <h3 className="font-extrabold text-2xl text-white mb-1">Standardni lokal</h3>
            <p className="text-xs text-orange-100 mb-6">30 – 100 smena mesečno</p>
            <div className="flex items-baseline gap-1.5 mb-6"><span className="font-extrabold text-5xl text-white">6%</span><span className="text-sm text-orange-100">/ smeni</span></div>
            <ul className="flex flex-col gap-2.5 text-sm text-white/90 font-light flex-1">
              {["Sve iz Startera", "PRO konobari prvi — viši u pretrazi", "Red Alert™ za hitne smene", "Napredni filteri (ocena, sanitarna, jezik)", "Analitika lokala (mesečno)", "Telefon podrška (radni dani)"].map(item => (
                <li key={item} className="check-row">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5"><circle cx="8" cy="8" r="7" fill="rgba(255,255,255,0.25)" /><path d="M5 8L7 10L11 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {item}
                </li>
              ))}
            </ul>
            <Link href="#demo" className="mt-7 bg-white hover:bg-orange-50 text-orange-600 font-bold text-sm py-3 rounded-xl text-center transition-colors">Zakaži demo</Link>
          </div>
          {/* Enterprise */}
          <div className="bg-white rounded-3xl p-7 border border-neutral-100 flex flex-col">
            <div className="text-[10px] tracking-widest uppercase font-bold text-neutral-400 mb-2">Enterprise</div>
            <h3 className="font-extrabold text-2xl text-neutral-900 mb-1">Lanac / hotel</h3>
            <p className="text-xs text-neutral-400 mb-6">100+ smena mesečno · više lokacija</p>
            <div className="flex items-baseline gap-1.5 mb-6"><span className="font-extrabold text-5xl text-neutral-900">5%</span><span className="text-sm text-neutral-400">/ smeni</span></div>
            <ul className="flex flex-col gap-2.5 text-sm text-neutral-600 font-light flex-1">
              {["Sve iz Pro plana", "Centralni dashboard za sve lokale", "API + integracija sa POS sistemom", "Personalni account manager", "SLA garancija popune (4h)", "Custom ugovorni okvir"].map(item => (
                <li key={item} className="check-row"><CheckOrange />{item}</li>
              ))}
            </ul>
            <Link href="#demo" className="mt-7 btn-secondary font-semibold text-sm py-3 rounded-xl text-center">Kontaktiraj prodaju</Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="max-w-4xl mx-auto px-6 py-24">
        <div className="text-center mb-12">
          <span className="inline-block bg-orange-50 border border-orange-100 text-orange-500 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">FAQ</span>
          <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">Pitanja vlasnika lokala</h2>
        </div>
        <FAQAccordion items={faqItems} />
      </section>

      {/* ── DEMO CTA ── */}
      <section id="demo" className="max-w-7xl mx-auto px-6 pb-24">
        <div className="rounded-[36px] overflow-hidden relative" style={{ background: "linear-gradient(160deg, #1c1209 0%, #2d1a06 100%)" }}>
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 60% at 80% 20%, rgba(249,115,22,0.30) 0%, transparent 60%)" }} />
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 48px), repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 48px)" }} />
          <div className="relative grid lg:grid-cols-[1.2fr_1fr] gap-10 p-10 sm:p-14 items-center">
            <div>
              <span className="inline-block bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">20 min · besplatno</span>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1]">
                Pokaži nam tvoj lokal —<br />pokazaćemo ti kako da popuniš<br />sledeću smenu za <span className="text-orange-400">15 minuta.</span>
              </h2>
              <p className="mt-5 text-base text-neutral-400 font-light leading-relaxed max-w-md">Personalni demo sa našim timom: prolazimo kroz tvoj realni scenario. Ako nema smisla — kažeš ne i nastavljamo dalje.</p>
              <div className="mt-8 flex flex-wrap gap-6 text-sm text-neutral-300">
                {["Bez obaveze potpisa", "Live primer sa stvarnim kandidatima", "30 dana 0% provizije za prvi mesec"].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="rgba(249,115,22,0.20)" /><path d="M5 8L7 10L11 6" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            {/* Demo form */}
            <div className="bg-white rounded-3xl p-7 shadow-2xl">
              <div className="text-[10px] tracking-widest uppercase font-bold text-orange-500 mb-1">Zakaži poziv</div>
              <h3 className="font-extrabold text-xl text-neutral-900 mb-5">Javljamo se u roku od 2h</h3>
              {submitted ? (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 7" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <div>
                    <div className="font-bold text-neutral-900">Hvala! Javljamo se →</div>
                    <div className="text-sm text-neutral-400 mt-1">Kontaktiraćemo vas u roku od 2 sata.</div>
                  </div>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} className="flex flex-col gap-3">
                  <input type="text" placeholder="Naziv lokala" required className="px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100" />
                  <input type="text" placeholder="Tvoje ime" required className="px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100" />
                  <input type="tel" placeholder="Telefon (npr. 064 ...)" required className="px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100" />
                  <select className="px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 text-neutral-700">
                    {["Restoran / fine dining", "Bar / kafe", "Klub / noćni objekat", "Kafana / tradicionalno", "Hotel / više objekata", "Drugo"].map(opt => (
                      <option key={opt}>{opt}</option>
                    ))}
                  </select>
                  <button type="submit" className="btn-primary text-white font-bold text-sm py-3.5 rounded-xl mt-2 cursor-pointer">Zakaži demo →</button>
                  <p className="text-[10px] text-neutral-400 text-center mt-1">Tvoje podatke ne delimo. Bez automatskih mejlova.</p>
                </form>
              )}
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
            <Link href="/for-waiters" className="hover:text-orange-500 transition-colors">Za konobare</Link>
            <Link href="/for-waiters" className="hover:text-orange-500 transition-colors">Passport™</Link>
            <Link href="/for-venues" className="hover:text-orange-500 transition-colors">Za lokale</Link>
            <Link href="/login" className="hover:text-orange-500 transition-colors">Prijava</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
