"use client";

import { useState } from "react";

export interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

export function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div key={i} className="bg-white border border-neutral-100 rounded-2xl overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0 text-orange-500 font-bold text-xs">
                ?
              </div>
              <span className="font-semibold text-sm text-neutral-800">{item.question}</span>
            </div>
            <svg
              className="flex-shrink-0 transition-transform duration-200"
              style={{ transform: open === i ? "rotate(180deg)" : "none" }}
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path d="M4 6L8 10L12 6" stroke="#a8a29e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {open === i && (
            <div className="px-6 pb-5">
              <div className="pl-11 text-sm text-neutral-500 font-light leading-relaxed">
                {item.answer}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
