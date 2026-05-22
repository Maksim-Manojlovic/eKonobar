"use client";

import { useEffect, useState, useRef } from "react";
import { useSession, signIn } from "next-auth/react";

const WARN_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 30_000;

type ToastState = "idle" | "warning" | "expired";

export default function SessionExpiryToast() {
  const { data: session, status } = useSession();
  const [state, setState] = useState<ToastState>("idle");
  const [dismissed, setDismissed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.expires) return;

    function check() {
      if (!session?.expires) return;
      const msLeft = new Date(session.expires).getTime() - Date.now();
      if (msLeft <= 0) {
        setState("expired");
        setDismissed(false);
      } else if (msLeft <= WARN_MS) {
        setState("warning");
      } else {
        setState("idle");
        setDismissed(false);
      }
    }

    check();
    intervalRef.current = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session, status]);

  if (state === "idle" || dismissed) return null;

  const isExpired = state === "expired";

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-72 animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div
        className={`rounded-2xl shadow-lg border px-5 py-4 flex flex-col gap-2.5 ${
          isExpired ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-black ${isExpired ? "text-red-700" : "text-amber-700"}`}>
            {isExpired ? "Sesija je istekla" : "Sesija uskoro ističe"}
          </p>
          {!isExpired && (
            <button
              onClick={() => setDismissed(true)}
              className="text-amber-400 hover:text-amber-600 text-lg leading-none flex-shrink-0 -mt-0.5"
              aria-label="Zatvori"
            >
              ×
            </button>
          )}
        </div>
        <p className={`text-xs leading-relaxed ${isExpired ? "text-red-600" : "text-amber-600"}`}>
          {isExpired
            ? "Prijavite se ponovo da biste nastavili sa radom."
            : "Bićete odjavljeni za manje od 5 minuta."}
        </p>
        <button
          onClick={() => signIn()}
          className={`text-xs font-bold rounded-xl px-3 py-1.5 transition-colors w-fit ${
            isExpired
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-amber-500 text-white hover:bg-amber-600"
          }`}
        >
          Prijavi se ponovo
        </button>
      </div>
    </div>
  );
}
