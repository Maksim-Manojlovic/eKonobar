"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

const DASH_PATHS: Record<string, string> = {
  VENUE_OWNER: "/venue",
  WAITER: "/waiter",
  HEADHUNTER: "/headhunter",
  ADMIN: "/admin",
};

export function NavAuthButton() {
  const { data: session } = useSession();

  if (session?.user) {
    const path = DASH_PATHS[session.user.role as string] ?? "/";
    return (
      <Link
        href={path}
        className="hidden sm:inline-block text-sm font-medium text-orange-500 hover:text-orange-600 transition-colors px-4 py-2"
      >
        Dashboard →
      </Link>
    );
  }

  return (
    <Link
      href="/login"
      className="hidden sm:inline-block text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors px-4 py-2"
    >
      Prijava
    </Link>
  );
}
