"use client";

import { useState } from "react";
import Link from "next/link";

interface StepCard {
  number: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}

const waiterSteps: StepCard[] = [
  {
    number: "01",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="white" />
      </svg>
    ),
    title: "Napravi Waiter Passport™",
    desc: "Kreiraj profil sa iskustvom, veštinama i dostupnošću. Tvoj Passport™ putuje sa tobom i gradi reputaciju.",
  },
  {
    number: "02",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="2.2" />
        <path d="M16.5 16.5L21 21" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M8.5 11H13.5M11 8.5V13.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: "Pronađi Red Alert™ oglas",
    desc: "Pretraži mapu ili listu. Red Alert™ oglasi su hitni — lokal treba nekoga odmah. Prijavi se jednim klikom.",
  },
  {
    number: "03",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M9 12L11 14L15 10" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 3C7.03 3 3 7.03 3 12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3Z" stroke="white" strokeWidth="2" fill="none" />
      </svg>
    ),
    title: "Radi i skupljaj recenzije",
    desc: "Nakon smene, geofencing sistem automatski verifikuje da si bio na lokaciji. Recenzije su proverene — ne može se lažirati.",
  },
];

const venueSteps: StepCard[] = [
  {
    number: "01",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="14" rx="3" stroke="white" strokeWidth="2" fill="none" />
        <path d="M12 9V13M10 11H14" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: "Postavi oglas za lokal",
    desc: "Za manje od 2 minuta objavi oglas sa svim detaljima — smena, plata, zahtevi. Možeš i aktivirati Red Alert™ za hitne potrebe.",
  },
  {
    number: "02",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="8" r="3.5" stroke="white" strokeWidth="2" fill="none" />
        <circle cx="16" cy="8" r="3.5" stroke="white" strokeWidth="2" fill="none" />
        <path d="M3 19C3 16.24 5.69 14 9 14" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <path d="M13 16.5C13.83 15.57 15.32 15 17 15C19.76 15 22 16.57 22 18.5" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    ),
    title: "Prelistaj Verified Profile-ove",
    desc: "Vidiš Waiter Passport™ svakog kandidata — proverene recenzije, istoriju rada i ocene. Nema iznenađenja.",
  },
  {
    number: "03",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L14.09 8.26L21 9.27L16.5 13.64L17.63 20.56L12 17.27L6.37 20.56L7.5 13.64L3 9.27L9.91 8.26L12 2Z" stroke="white" strokeWidth="2" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    title: "Oceni i gradi tim",
    desc: "Nakon smene oceni konobara. Dodaj favoritima i pozovi ponovo jednim klikom. Gradi pouzdan pool zaposlenih.",
  },
];

function Card({ step }: { step: StepCard }) {
  return (
    <div className="bg-white rounded-3xl p-8 border border-neutral-100 shadow-sm relative overflow-hidden group hover:-translate-y-1 transition-transform duration-200">
      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="relative z-10">
        <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center mb-6 shadow-md shadow-orange-100">
          {step.icon}
        </div>
        <div className="text-4xl font-black text-orange-100 absolute top-6 right-8 select-none">{step.number}</div>
        <h3 className="text-xl font-bold text-neutral-900 mb-3">{step.title}</h3>
        <p className="text-neutral-400 font-light leading-relaxed text-sm">{step.desc}</p>
      </div>
    </div>
  );
}

export function HowItWorksSection() {
  const [tab, setTab] = useState<"waiter" | "venue">("waiter");
  const steps = tab === "waiter" ? waiterSteps : venueSteps;

  return (
    <section className="max-w-7xl mx-auto px-6 pb-32">

      {/* Header */}
      <div className="text-center mb-16">
        <span className="inline-block bg-orange-50 border border-orange-100 text-orange-500 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">
          Kako funkcioniše
        </span>
        <h2 className="text-4xl xl:text-5xl font-extrabold text-neutral-900 tracking-tight leading-tight">
          Tri koraka do <span className="text-orange-500">savršenog</span> angažmana
        </h2>
        <p className="mt-4 text-lg text-neutral-400 font-light max-w-xl mx-auto">
          Brzo, transparentno i bez posrednika. Konobari i lokali direktno jedni s drugima.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex justify-center mb-14">
        <div className="bg-neutral-100 rounded-2xl p-1 flex gap-1 text-sm font-semibold">
          <button
            onClick={() => setTab("waiter")}
            className={`px-6 py-2.5 rounded-xl transition-all ${
              tab === "waiter" ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            Za konobara
          </button>
          <button
            onClick={() => setTab("venue")}
            className={`px-6 py-2.5 rounded-xl transition-all ${
              tab === "venue" ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            Za vlasnika
          </button>
        </div>
      </div>

      {/* Step cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {steps.map((step) => (
          <Card key={step.number} step={step} />
        ))}
      </div>

      {/* Bottom CTA strip */}
      <div
        className="mt-14 rounded-3xl px-10 py-10 flex flex-col md:flex-row items-center justify-between gap-6"
        style={{
          background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
          boxShadow: "0 8px 40px rgba(249,115,22,0.3)",
        }}
      >
        <div>
          <div className="text-white font-extrabold text-2xl tracking-tight">Spreman si. Počni odmah.</div>
          <div className="text-orange-100 text-sm font-light mt-1">Registracija je besplatna. Bez skrivenih troškova.</div>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <Link href="/jobs" className="bg-white text-orange-500 font-bold text-sm px-6 py-3 rounded-2xl hover:bg-orange-50 transition-colors">
            Traži posao
          </Link>
          <Link href="/register" className="bg-orange-600 text-white font-bold text-sm px-6 py-3 rounded-2xl border border-orange-400 hover:bg-orange-700 transition-colors">
            Postavi oglas
          </Link>
        </div>
      </div>

    </section>
  );
}
