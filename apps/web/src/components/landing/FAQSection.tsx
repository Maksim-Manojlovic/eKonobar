"use client";

import { useState } from "react";

interface FAQItem {
  icon: React.ReactNode;
  question: string;
  answer: React.ReactNode;
}

const faqs: FAQItem[] = [
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M8 1C4.13 1 1 4.13 1 8C1 11.87 4.13 15 8 15C11.87 15 15 11.87 15 8C15 4.13 11.87 1 8 1ZM8.75 12H7.25V7.25H8.75V12ZM8 5.875C7.48 5.875 7.0625 5.4575 7.0625 4.9375C7.0625 4.4175 7.48 4 8 4C8.52 4 8.9375 4.4175 8.9375 4.9375C8.9375 5.4575 8.52 5.875 8 5.875Z" fill="#f97316" />
      </svg>
    ),
    question: "Da li je aplikacija besplatna za konobara?",
    answer: (
      <>
        Da — uvek i zauvek. Konobarima je eKonobar <strong className="font-semibold text-neutral-700">potpuno besplatan</strong>: kreiranje profila, Waiter Passport™, prijave na oglase i primanje ocena. Naplaćujemo samo vlasnicima lokala koji postavljaju oglase.
      </>
    ),
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M8 1C5.24 1 3 3.24 3 6C3 9.5 8 15 8 15C8 15 13 9.5 13 6C13 3.24 10.76 1 8 1ZM8 7.5C7.17 7.5 6.5 6.83 6.5 6C6.5 5.17 7.17 4.5 8 4.5C8.83 4.5 9.5 5.17 9.5 6C9.5 6.83 8.83 7.5 8 7.5Z" fill="#f97316" />
      </svg>
    ),
    question: "Kako funkcioniše provera lokacije?",
    answer: (
      <>
        Kada stigneš na smenu, aplikacija ti šalje notifikaciju da potvrdiš check-in. GPS verifikuje da si unutar <strong className="font-semibold text-neutral-700">radijusa od 100m</strong> od lokala. Isto važi na kraju smene. Taj podatak se automatski upisuje u tvoj Waiter Passport™ — bez papira, bez poziva. Lokacija se <strong className="font-semibold text-neutral-700">ne prati</strong> tokom smene, samo u momentu check-in/out-a.
      </>
    ),
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="6" r="3" stroke="#f97316" strokeWidth="1.5" fill="none" />
        <path d="M2 14C2 11.24 4.69 9 8 9C11.31 9 14 11.24 14 14" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    ),
    question: "Šta ako nemam iskustva?",
    answer: (
      <>
        Savršeno mesto za početak! Algoritam preporučuje <strong className="font-semibold text-neutral-700">manje angažmane</strong> — privatne proslave, ketering evente i vikend kafiće — koji su idealni za gradnju prvih ocena. Posle 3-5 angažmana tvoj Passport™ već ima dovoljno istorije da te preporuči i premium lokalima.
      </>
    ),
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M8 1L9.545 5.27H14.09L10.273 7.855L11.818 12.125L8 9.54L4.182 12.125L5.727 7.855L1.82 5.27H6.455L8 1Z" fill="#f97316" />
      </svg>
    ),
    question: "Kako funkcioniše Red Alert™ za vlasnike?",
    answer: (
      <>
        Jednim klikom aktiviraš Red Alert™ oglas koji ide svim dostupnim konobarima u krugu od 5km. Oni koji su slobodni i koji odgovaraju traženom profilu dobijaju push notifikaciju. Ti biraš između prijavljenih — prosečno vreme: <strong className="font-semibold text-neutral-700">11 minuta</strong> do potvrđene zamene.
      </>
    ),
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="10" rx="2.5" stroke="#f97316" strokeWidth="1.5" fill="none" />
        <path d="M5 8H11M5 5.5H8.5M5 10.5H9" stroke="#f97316" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
    question: "Mogu li koristiti platformu van Beograda?",
    answer: (
      <>
        Za sada smo fokusirani na <strong className="font-semibold text-neutral-700">Beograd</strong> kako bismo osigurali vrhunsko iskustvo. Novi Sad i Niš su u planu za Q3 2026. Možeš se prijaviti na listu čekanja za tvoj grad.
      </>
    ),
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M13 5H9V1L3 8H7V12L13 5Z" stroke="#f97316" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    question: "Koliko brzo mogu da počnem da radim?",
    answer: (
      <>
        Registracija traje <strong className="font-semibold text-neutral-700">manje od 3 minuta</strong>. Nakon verifikacije profila (do 24h), odmah možeš da se prijaviš na oglase. Ako imaš sanitarnu knjižicu i osnovne dokumente, možeš biti na prvoj smeni već sutra.
      </>
    ),
  },
];

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  function toggle(i: number) {
    setOpen(open === i ? null : i);
  }

  return (
    <section className="max-w-7xl mx-auto px-6 py-28">

      {/* Header */}
      <div className="text-center mb-14">
        <span className="inline-block bg-orange-50 border border-orange-100 text-orange-500 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">
          FAQ
        </span>
        <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-900 tracking-tight">Česta pitanja</h2>
        <p className="mt-4 text-lg text-neutral-400 font-light max-w-md mx-auto">
          Sve što treba da znaš pre nego što kreneš.
        </p>
      </div>

      {/* FAQ grid */}
      <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
        {faqs.map((faq, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              className="bg-white border rounded-3xl overflow-hidden shadow-sm cursor-pointer transition-colors"
              style={{ borderColor: isOpen ? "rgba(249,115,22,0.3)" : "" }}
              onClick={() => toggle(i)}
            >
              <div className="flex items-center justify-between gap-4 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                    {faq.icon}
                  </div>
                  <span className="font-semibold text-neutral-800 text-sm leading-snug">{faq.question}</span>
                </div>
                <div
                  className="w-6 h-6 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0 transition-transform duration-200"
                  style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 4L6 8L10 4" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              {isOpen && (
                <div className="px-6 pb-5">
                  <div className="pl-11">
                    <p className="text-sm text-neutral-500 font-light leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="mt-10 text-center">
        <p className="text-neutral-400 text-sm font-light">
          Nisi pronašao odgovor?{" "}
          <a href="/contact" className="text-orange-500 font-semibold hover:text-orange-600 transition-colors ml-1">
            Kontaktiraj nas →
          </a>
        </p>
      </div>

    </section>
  );
}
