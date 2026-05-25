"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { NotificationsSection } from "@/components/ui/NotificationsSection";
import DashboardShell from "@/components/layout/DashboardShell";
import { useDashboardNav } from "@/hooks/useDashboardNav";
import type { Section, JobPost, MyApplication, WaiterShift, InviteItem, PassportData, ManagedShift } from "./waiter-types";
import { SECTION_TITLES } from "./waiter-constants";
import { getInitials } from "@/lib/format-utils";
import { NAV_ITEMS } from "./waiter-helpers";
import { OverviewSection } from "./WaiterOverviewSection";
import { AlertsSection, JobsSection, ApplicationsSection } from "./WaiterJobsSection";
import { InvitesSection } from "./WaiterInvitesSection";
import { ReviewsSection } from "./WaiterReviewsSection";
import { ShiftsSection, HeadWaiterSmeneSection } from "./WaiterSmeneSection";
import PassportSection from "./WaiterPassportSection";

/* ── Main dashboard ──────────────────────────────────────────────────────── */

export default function WaiterDashboard() {
  const { data: session } = useSession();
  const { section, setSection, notifUnread, setNotifUnread, today } = useDashboardNav<Section>("overview");
  const [paymentToast, setPaymentToast] = useState<"success" | "cancelled" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success" || payment === "cancelled") {
      setPaymentToast(payment);
      window.history.replaceState({}, "", window.location.pathname);
      if (payment === "success") setSection("passport");
      setTimeout(() => setPaymentToast(null), 5000);
    }
  }, []);

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
  const navContent = (closeMenu?: () => void) => (
    <>
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV_ITEMS.map(item => (
          <button key={item.key}
            onClick={() => { setSection(item.key); closeMenu?.(); }}
            className={`nav-item ${section === item.key ? "active" : ""}`}>
            {item.icon}{item.label}
            {item.key === "alerts" && alertCount > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{alertCount}</span>
            )}
            {item.key === "invites" && inviteCount > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{inviteCount}</span>
            )}
            {item.key === "notifications" && notifUnread > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{notifUnread > 9 ? "9+" : notifUnread}</span>
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
            Šef konobara
            <span className="ml-auto text-[9px] bg-orange-500/20 text-orange-300 font-bold px-1.5 py-0.5 rounded-full border border-orange-500/30">ŠEFOV</span>
          </button>
        )}
      </nav>
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-orange-900/40 flex items-center justify-center text-orange-300 font-bold text-sm flex-shrink-0 border border-orange-500/30">{initials}</div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{userName}</div>
            <div className="text-[11px] text-white/40 truncate">Konobar</div>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/" })} className="nav-item text-red-400/80 hover:bg-red-900/20 hover:text-red-300 w-full">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Odjavi se
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Payment toast — rendered outside shell to stay above everything */}
      {paymentToast && (
        <div className={`fixed top-5 right-5 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold transition-all ${paymentToast === "success" ? "bg-green-600 text-white" : "bg-neutral-700 text-white"}`}>
          {paymentToast === "success" ? (
            <><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>Passport Pro aktiviran! Pretplata je uspešno pokrenuta.</>
          ) : (
            <><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>Plaćanje otkazano.</>
          )}
        </div>
      )}

      <DashboardShell
        sectionTitle={SECTION_TITLES[section]}
        today={today}
        navContent={navContent}
        topRight={
          <>
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
        {section === "alerts"        && <AlertsSection jobs={jobs} loading={loading} onApply={handleApply} applying={applying} appliedJobIds={appliedJobIds} />}
        {section === "jobs"          && <JobsSection jobs={jobs} loading={loading} onApply={handleApply} applying={applying} appliedJobIds={appliedJobIds} />}
        {section === "applications"  && <ApplicationsSection applications={applications} loading={loading} />}
        {section === "shifts"        && <ShiftsSection shifts={shifts} loading={loading} onRefresh={fetchData} />}
        {section === "invites"       && <InvitesSection invites={invites} loading={loading} onRespond={handleInviteRespond} />}
        {section === "reviews"       && <ReviewsSection />}
        {section === "passport"      && <PassportSection userName={userName} />}
        {section === "manage"        && managedVenue && <HeadWaiterSmeneSection venue={managedVenue} shifts={managedShifts} loading={loading} onRefresh={fetchData} />}
        {section === "notifications" && <NotificationsSection />}
      </DashboardShell>
    </>
  );
}
