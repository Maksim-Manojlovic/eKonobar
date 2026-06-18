"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Catches errors thrown in the ROOT layout itself (where the normal error.tsx
 * boundary cannot reach). Replaces the root layout, so it must render its own
 * <html>/<body>. Reports to Sentry — without this, a root-layout crash is a
 * blank, unreported white screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
          <div className="text-center space-y-2">
            <p className="text-orange-500 text-sm font-semibold uppercase tracking-widest">Greška</p>
            <h1 className="text-2xl font-bold text-neutral-900">Nešto je pošlo naopako</h1>
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
      </body>
    </html>
  );
}
