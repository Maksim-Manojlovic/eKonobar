"use client";

import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import Link from "next/link";

const SIDEBAR_STYLE = {
  background: "#0e0700",
  backgroundImage: [
    "linear-gradient(rgba(180,90,20,0.10) 1px, transparent 1px)",
    "linear-gradient(90deg, rgba(180,90,20,0.10) 1px, transparent 1px)",
  ].join(", "),
  backgroundSize: "40px 40px",
  borderRight: "1px solid rgba(180,90,20,0.18)",
} as const;

const MAIN_BG_STYLE = {
  background: "#120a00",
  backgroundImage: [
    "linear-gradient(rgba(180,90,20,0.11) 1px, transparent 1px)",
    "linear-gradient(90deg, rgba(180,90,20,0.11) 1px, transparent 1px)",
  ].join(", "),
  backgroundSize: "40px 40px",
} as const;

export interface DashboardShellHandle {
  /** Opens mobile sidebar drawer — used by driver.js tour before querying element positions */
  openMobile(): void;
}

interface DashboardShellProps {
  /** Section title shown in sticky header h1 */
  sectionTitle: string;
  /** Date subtitle shown in sticky header */
  today: string;
  /** Nav tree rendered inside both mobile drawer and desktop sidebar */
  navContent: (closeMenu?: () => void, idPrefix?: string) => React.ReactNode;
  /** Right side of sticky header (NotificationBell + avatar/profile menu) */
  topRight?: React.ReactNode;
  /** id applied to desktop sidebar <aside> (for driver.js tour) */
  sidebarId?: string;
  /** id applied to mobile sidebar <div> (for driver.js tour) */
  mobileSidebarId?: string;
  /** Main content area */
  children: React.ReactNode;
}

const DashboardShell = forwardRef<DashboardShellHandle, DashboardShellProps>(
  function DashboardShell(
    { sectionTitle, today, navContent, topRight, sidebarId, mobileSidebarId, children },
    ref,
  ) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const spotlightRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      openMobile: () => setMobileOpen(true),
    }));

    function handleMouseMove(e: React.MouseEvent) {
      if (!spotlightRef.current) return;
      spotlightRef.current.style.background =
        `radial-gradient(600px circle at ${e.clientX}px ${e.clientY}px, rgba(249,115,22,0.07), transparent 70%)`;
    }

    const Logo = () => (
      <Link href="/" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black text-sm">eK</div>
        <span className="font-black text-white text-base">eKonobar</span>
      </Link>
    );

    return (
      <div
        className="flex min-h-screen"
        style={MAIN_BG_STYLE}
        onMouseMove={handleMouseMove}
      >
        {/* Mouse spotlight overlay */}
        <div ref={spotlightRef} className="pointer-events-none fixed inset-0" style={{ zIndex: 1 }} />

        {/* Mobile backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Mobile drawer */}
        <div
          id={mobileSidebarId}
          className={`dark-sidebar fixed inset-y-0 left-0 z-50 w-64 flex flex-col md:hidden transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
          style={{ ...SIDEBAR_STYLE, position: "fixed" }}
        >
          <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
            <Logo />
            <button
              onClick={() => setMobileOpen(false)}
              className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white/80"
              aria-label="Zatvori meni"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          {navContent(() => setMobileOpen(false), "mob-tour")}
        </div>

        {/* Desktop sidebar */}
        <aside
          id={sidebarId}
          className="dark-sidebar hidden md:flex flex-col w-60 min-h-screen sticky top-0 h-screen overflow-y-auto"
          style={{ ...SIDEBAR_STYLE, position: "relative", zIndex: 2 }}
        >
          <div className="px-5 py-5 border-b border-white/10">
            <Logo />
          </div>
          {navContent()}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto" style={{ position: "relative", zIndex: 2 }}>
          {/* Sticky header */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
            style={{
              background: "rgba(18,10,0,0.88)",
              backdropFilter: "blur(12px)",
              borderBottom: "1px solid rgba(180,90,20,0.2)",
            }}
          >
            <div className="flex items-center gap-3">
              {/* Hamburger — mobile only */}
              <button
                className="md:hidden w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center hover:border-orange-400/50 transition-colors text-white"
                onClick={() => setMobileOpen(true)}
                aria-label="Otvori meni"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <div>
                <h1 className="font-black text-white text-lg">{sectionTitle}</h1>
                <p className="text-xs text-orange-300/60 capitalize">{today}</p>
              </div>
            </div>
            {topRight && (
              <div className="flex items-center gap-2">{topRight}</div>
            )}
          </div>

          {/* Page content */}
          <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    );
  },
);

export default DashboardShell;
