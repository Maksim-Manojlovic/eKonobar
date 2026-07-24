"use client";

import { useState } from "react";
import Link from "next/link";
import { FAQAccordion } from "@/components/ui/FAQAccordion";
import { FeatureGrid } from "@/components/ui/FeatureGrid";
import { CheckIcon } from "@/components/ui/CheckIcon";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { NAV_LINKS_VENUE, FOOTER_LINKS, HERO_STATS, COMPARISON_ROWS, VENUE_FEATURES, faqItems } from "./content";

export default function ForVenuesPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="page-bg min-h-screen">

      {/* ── NAV ── */}
      <LandingNav
        links={NAV_LINKS_VENUE}
        cta={{ href: "#demo", label: "Zakaži demo" }}
        badge="za vlasnike"
      />

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
              Pronađite proverene konobare i šankere — bez agencija i beskrajnih poziva.{" "}
              <strong className="font-semibold text-neutral-700">Plaćate samo odrađenu smenu.</strong>
            </p>

            <div className="flex flex-wrap gap-4 pt-1">
              <Link href="#demo" className="btn-primary text-white font-bold text-base px-8 py-4 rounded-2xl flex items-center gap-2.5">
                Zakaži demo (20 min)
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M9 4L13 8L9 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
              <Link href="/register?role=venue" className="btn-secondary font-semibold text-base px-8 py-4 rounded-2xl flex items-center gap-2.5">Postavi prvi oglas</Link>
            </div>

            {/* Stats strip (folded in from the old ROI section) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-neutral-200/60 max-w-2xl">
              {HERO_STATS.map(s => (
                <div key={s.label}>
                  <div className="font-extrabold text-2xl text-neutral-900">{s.value}</div>
                  <div className="text-[11px] text-neutral-400 font-medium mt-0.5">{s.label}</div>
                </div>
              ))}
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
                        <span className="tier-pill bg-green-600 text-white">✓ VERIFIKOVAN</span>
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
                  { init: "JN", name: "Jovana N.", tier: "✓ VERIFIKOVAN", score: "87 skor · 64 smene · 4.7★" },
                  { init: "SP", name: "Stefan P.", tier: "✓ VERIFIKOVAN", score: "82 skor · 41 smena · 4.6★" },
                ].map(c => (
                  <div key={c.init} className="bg-white rounded-2xl p-3.5 border border-neutral-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">{c.init}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-neutral-800">{c.name}</span>
                        <span className="tier-pill bg-green-100 text-green-700">{c.tier}</span>
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
      </section>

      {/* ── MOGUĆNOSTI (feature overview) ── */}
      <FeatureGrid
        id="mogucnosti"
        kicker="Sve na jednom mestu"
        heading={<>Ne samo popuna smene — <span className="text-orange-500">ceo tvoj lokal.</span></>}
        sub="Marketplace za hitne zamene, raspored stalne ekipe, sala i kuhinja, godišnji odmori — bez Excel-a i bez agencija."
        tiles={VENUE_FEATURES}
      />

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

      {/* ── OPERATIVA (deep-dive: raspored / osoblje / odmori) ── */}
      <section id="operativa" className="max-w-7xl mx-auto px-6 py-24">
        <div className="max-w-3xl mb-14">
          <span className="inline-flex items-center gap-2 bg-orange-50 border border-orange-100 text-orange-500 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">
            <span className="bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded">NOVO</span>
            Operativa
          </span>
          <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">
            Vodiš stalnu ekipu — <span className="text-orange-500">bez Excel-a.</span>
          </h2>
          <p className="mt-4 text-lg text-neutral-500 font-light leading-relaxed">
            Raspored smena, osoblje sale i kuhinje i godišnji odmori — sve na jednom mestu.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Raspored & smene */}
          <div className="bg-white rounded-3xl p-8 border border-neutral-100 flex flex-col gap-5">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="#f97316" strokeWidth="2"/><path d="M3 10h18M8 2v4M16 2v4M9 15l2 2 4-4" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <span className="text-[10px] font-black tracking-widest uppercase text-orange-500">Raspored & smene</span>
              <h3 className="font-bold text-xl text-neutral-900 mt-1 leading-tight">Ceo raspored — templati, ne ručno.</h3>
            </div>
            <ul className="flex flex-col gap-2.5 text-sm text-neutral-600 font-light flex-1">
              {[
                <>Templati za ponavljajuće smene — generiši ceo mesec za par sekundi</>,
                <><strong className="font-semibold text-neutral-700">GPS check-in</strong> potvrđuje dolazak — geofencing, bez lažiranja sati</>,
                <>Zamene bez tvog telefona — konobar traži, ti samo odobriš</>,
                <>Fali čovek? Smena ide na <strong className="font-semibold text-neutral-700">marketplace</strong> automatski</>,
              ].map((item, i) => (
                <li key={i} className="check-row"><CheckIcon />{item}</li>
              ))}
            </ul>
          </div>

          {/* Osoblje — Sala + Kuhinja */}
          <div className="bg-white rounded-3xl p-8 border border-neutral-100 flex flex-col gap-5">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <span className="text-[10px] font-black tracking-widest uppercase text-orange-500">Osoblje</span>
              <h3 className="font-bold text-xl text-neutral-900 mt-1 leading-tight">Sala i kuhinja — cela ekipa.</h3>
            </div>
            <ul className="flex flex-col gap-2.5 text-sm text-neutral-600 font-light flex-1">
              {[
                <>Stalni tim po pozicijama — od konobara i šankera do <strong className="font-semibold text-neutral-700">šefa kuhinje i kuvara</strong></>,
                <>Sala (FOH) i kuhinja (BOH) odvojeno — svaki sektor svoj raspored i kapacitet</>,
                <>Šef sale i šef kuhinje vode svoj deo — ti vidiš sve</>,
                <>Tip angažmana i status po članu — uredna evidencija</>,
              ].map((item, i) => (
                <li key={i} className="check-row"><CheckIcon />{item}</li>
              ))}
            </ul>
          </div>

          {/* Godišnji odmori */}
          <div className="bg-white rounded-3xl p-8 border border-neutral-100 flex flex-col gap-5">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M8 2v4M16 2v4M3 10h18" stroke="#f97316" strokeWidth="2" strokeLinecap="round"/><rect x="3" y="4" width="18" height="18" rx="2" stroke="#f97316" strokeWidth="2"/><path d="M8 15h3M8 18h5" stroke="#f97316" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <div>
              <span className="text-[10px] font-black tracking-widest uppercase text-orange-500">Godišnji odmori</span>
              <h3 className="font-bold text-xl text-neutral-900 mt-1 leading-tight">Godišnji po Zakonu o radu — automatski.</h3>
            </div>
            <ul className="flex flex-col gap-2.5 text-sm text-neutral-600 font-light flex-1">
              {[
                <>Balans dana po zaposlenom — <strong className="font-semibold text-neutral-700">26 dana</strong> po difoltu, iznad zakonskog minimuma</>,
                <>Zahtev se <strong className="font-semibold text-neutral-700">auto-odobrava</strong> kad prođe tvoja pravila — bez papira</>,
                <>Blackout dani za špic sezonu — ograniči koliko ljudi sme na odmor istog dana</>,
                <>Bolovanje se vodi odvojeno — ne troši godišnji</>,
              ].map((item, i) => (
                <li key={i} className="check-row"><CheckIcon />{item}</li>
              ))}
            </ul>
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
          {COMPARISON_ROWS.map(([label, agency, ek]) => (
            <div key={label} className="cmp-row">
              <div className="cmp-cell"><span className="font-medium text-neutral-700">{label}</span></div>
              <div className="cmp-cell text-center cmp-x">{agency}</div>
              <div className="cmp-cell text-center font-bold text-orange-500" style={{ background: "rgba(249,115,22,0.04)" }}>{ek}</div>
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
                <li key={item} className="check-row"><CheckIcon />{item}</li>
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
              {["Sve iz Startera", "Rangiranje po skoru — najbolji prvi", "Red Alert™ za hitne smene", "Napredni filteri (ocena, sanitarna, jezik)", "Analitika lokala (mesečno)", "Telefon podrška (radni dani)"].map(item => (
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
                <li key={item} className="check-row"><CheckIcon />{item}</li>
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
      <LandingFooter links={FOOTER_LINKS} />
    </div>
  );
}
