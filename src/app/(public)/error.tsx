"use client";

import { useEffect } from "react";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <div className="text-center space-y-2">
        <p className="text-orange-500 text-sm font-semibold uppercase tracking-widest">Greška</p>
        <h1 className="text-2xl font-bold text-neutral-900">Nešto je pošlo naopako</h1>
        <p className="text-neutral-500 text-sm max-w-sm">
          Stranica nije mogla da se učita. Pokušajte ponovo.
        </p>
        {error.digest && (
          <p className="text-neutral-400 text-xs font-mono">ID: {error.digest}</p>
        )}
      </div>
      <button
        onClick={reset}
        className="px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors"
      >
        Pokušaj ponovo
      </button>
    </div>
  );
}
