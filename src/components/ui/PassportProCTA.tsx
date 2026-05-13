"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

interface Props {
  label: string;
  className?: string;
}

export function PassportProCTA({ label, className }: Props) {
  const { data: session } = useSession();
  const href = session?.user?.role === "WAITER" ? "/waiter" : "/register";

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
