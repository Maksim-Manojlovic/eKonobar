"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WaiterJobsPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/waiter"); }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafaf8" }}>
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );
}
