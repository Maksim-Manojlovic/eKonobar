"use client";

import React from "react";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { NotificationsSection } from "@/components/ui/NotificationsSection";
import DashboardShell from "@/components/layout/DashboardShell";
import { useDashboardNav } from "@/hooks/useDashboardNav";
import type { Section, JobPost, MyApplication, WaiterShift, InviteItem, PassportData, ManagedShift } from "./waiter-types";
import { getInitials } from "@/lib/formatting/utils";
import { OverviewSection } from "./WaiterOverviewSection";
import { PosloviHub } from "./WaiterJobsSection";
import { ReviewsSection } from "./WaiterReviewsSection";
import { ShiftsSection, HeadWaiterSmeneSection } from "./WaiterSmeneSection";
import PassportSection from "./WaiterPassportSection";
import { useLang } from "@/components/providers/LanguageProvider";
import { FlagSwitcher } from "@/components/ui/FlagSwitcher";

/* ── Nav constants ───────────────────────────────────────────────────────── */

const JOBS_SECTIONS = new Set<Section>(["alerts", "jobs", "applications", "invites"]);

const NAV_ITEMS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Pregled",   icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg> },
  { key: "jobs",     label: "Poslovi",   icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg> },
  { key: "shifts",   label: "Smene",     icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
  { key: "reviews",  label: "Recenzije", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg> },
];

const BOTTOM_NAV_ITEMS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: "passport",      label: "Passport",    icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg> },
  { key: "notifications", label: "Obaveštenja", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
];

/* ── Main dashboard ──────────────────────────────────────────────────────── */

export default function WaiterDashboard() {
  const { data: session } = useSession();
  const { section, setSection, notifUnread, setNotifUnread, today } = useDashboardNav<Section>("overview");
  const { t } = useLang();
  const [jobs, setJobs]                 = useState<JobPost[]>([]);
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [loading, setLoading]           = useState(true);
  const [applying, setApplying]         = useState<string | null>(null);
  const [shifts, setShifts]             = useState<WaiterShift[]>([]);
  const [invites, setInvites]           = useState<InviteItem[]>([]);
  const [passport, setPassport]         = useState<PassportData | null>(null);
  const [managedVenue, setManagedVenue] = useState<{ id: string; name: string } | null>(null);
  const [managedShifts, setManagedShifts] = useState<ManagedShift[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [jobsRes, appsRes, shiftsRes, invitesRes, passportRes, manageRes] = await Promise.all([
      fetch("/api/jobs"),
      fetch("/api/jobs/applications"),
      fetch("/api/shifts"),
      fetch("/api/invites"),
      fetch("/api/passport"),
      fetch("/api/shifts?view=manage"),
    ]);
    if (jobsRes.ok)     setJobs(await jobsRes.json());
    if (appsRes.ok)     setApplications(await appsRes.json());
    if (shiftsRes.ok)   setShifts(await shiftsRes.json());
    if (invitesRes.ok)  setInvites(await invitesRes.json());
    if (passportRes.ok) { const p = await passportRes.json(); if (p?.id) setPassport(p); }
    if (manageRes.ok) {
      const m = await manageRes.json();
      if (m?.venue) { setManagedVenue(m.venue); setManagedShifts(m.shifts ?? []); }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApply = async (jobPostId: string) => {
    setApplying(jobPostId);
    const res = await fetch("/api/jobs/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobPostId }),
    });
    if (res.ok) await fetchData();
    setApplying(null);
  };

  const handleInviteRespond = async (id: string, status: "ACCEPTED" | "DECLINED") => {
    await fetch(`/api/invites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchData();
  };

  const userName      = session?.user?.name ?? "Konobar";
  const initials      = getInitials(session?.user?.name);
  const appliedJobIds = new Set(applications.map(a => a.jobPost.id));
  const alertCount    = jobs.filter(j => j.redAlert).length;
  const inviteCount   = invites.filter(i => i.status === "PENDING").length;
  const totalBadge = alertCount + inviteCount;

  const navContent = (closeMenu?: () => void) => (
    <>
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV_ITEMS.map(item => (
          <button key={item.key}
            onClick={() => { setSection(item.key); closeMenu?.(); }}
            className={`nav-item ${section === item.key || (item.key === "jobs" && JOBS_SECTIONS.has(section)) ? "active" : ""}`}>
            {item.icon}{t("waiterNav", item.key)}
            {item.key === "jobs" && totalBadge > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{totalBadge > 9 ? "9+" : totalBadge}</span>
            )}
          </button>
        ))}
        {managedVenue && (
          <button
            onClick={() => { setSection("manage"); closeMenu?.(); }}
            className={`nav-item ${section === "manage" ? "active" : ""}`}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            {t("waiterUi", "headWaiter")}
            <span className="ml-auto text-[9px] bg-orange-500/20 text-orange-300 font-bold px-1.5 py-0.5 rounded-full border border-orange-500/30">{t("waiterUi", "headWaiterBadge")}</span>
          </button>
        )}
      </nav>
      <div className="px-3 pt-2 pb-1 border-t border-white/10 flex flex-col gap-1">
        {BOTTOM_NAV_ITEMS.map(item => (
          <button key={item.key}
            onClick={() => { setSection(item.key); closeMenu?.(); }}
            className={`nav-item ${section === item.key ? "active" : ""}`}>
            {item.icon}{t("waiterNav", item.key)}
            {item.key === "notifications" && notifUnread > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{notifUnread > 9 ? "9+" : notifUnread}</span>
            )}
          </button>
        ))}
      </div>
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-orange-900/40 flex items-center justify-center text-orange-300 font-bold text-sm flex-shrink-0 border border-orange-500/30">{initials}</div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{userName}</div>
            <div className="text-[11px] text-white/40 truncate">{t("waiterUi", "role")}</div>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/" })} className="nav-item text-red-400/80 hover:bg-red-900/20 hover:text-red-300 w-full">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {t("waiterUi", "signOut")}
        </button>
      </div>
    </>
  );

  return (
    <>
      <DashboardShell
        sectionTitle={t("waiterTitles", section)}
        today={today}
        navContent={navContent}
        topRight={
          <>
            <FlagSwitcher variant="dark" />
            <NotificationBell
              dashboardPath="/dashboard/waiter"
              onViewAll={() => setSection("notifications")}
              onUnreadChange={setNotifUnread}
            />
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-300 font-bold text-sm border border-orange-500/30">
              {initials}
            </div>
          </>
        }
      >
        {section === "overview"      && <OverviewSection jobs={jobs} applications={applications} shifts={shifts} userName={userName} verificationTier={session?.user?.verificationTier ?? "BRONZE"} passport={passport} onNavigate={setSection} onApply={handleApply} applying={applying} loading={loading} />}
        {JOBS_SECTIONS.has(section)   && <PosloviHub section={section} jobs={jobs} applications={applications} invites={invites} loading={loading} onApply={handleApply} applying={applying} appliedJobIds={appliedJobIds} onRespond={handleInviteRespond} onNavigate={setSection} />}
        {section === "shifts"        && <ShiftsSection shifts={shifts} loading={loading} onRefresh={fetchData} />}
        {section === "reviews"       && <ReviewsSection />}
        {section === "passport"      && <PassportSection userName={userName} />}
        {section === "manage"        && managedVenue && <HeadWaiterSmeneSection venue={managedVenue} shifts={managedShifts} loading={loading} onRefresh={fetchData} />}
        {section === "notifications" && <NotificationsSection />}
      </DashboardShell>
    </>
  );
}
