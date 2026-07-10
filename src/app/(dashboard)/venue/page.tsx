"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { NotificationsSection } from "@/components/ui/NotificationsSection";
import { useDashboardTour } from "@/hooks/useDashboardTour";
import { useDashboardNav } from "@/hooks/useDashboardNav";
import DashboardShell, { type DashboardShellHandle } from "@/components/layout/DashboardShell";
import type { Section, Venue, OwnPost, IncomingApp, WaiterEntry, VenueShift } from "./venue-types";
import { useLang } from "@/components/providers/LanguageProvider";
import { FlagSwitcher } from "@/components/ui/FlagSwitcher";
import { getInitials } from "@/lib/formatting/utils";
import { ENGAGEMENT_LABELS, VENUE_TYPE_LABELS } from "@/lib/formatting/display-maps";
import { PostStatusBadge, AppStatusBadge, OverviewSkeleton, EmptyVenue, trustDimensions } from "./venue-helpers";
import ProfileSection from "./ProfileSection";
import VenueSmeneSection from "./VenueSmeneSection";
import { JobsHub } from "./VenueJobsSection";
import { InviteModal } from "./VenueDiscoverSection";
import { ReviewsHub } from "./VenueReviewsSection";
import VenueAnalyticsSection from "./VenueAnalyticsSection";

/* ── Section: Overview ───────────────────────────────────────────────────── */

function OverviewSection({ venue, posts, applications, loading, onNavigate, geofenceEnabled, geofenceSaving, onGeofenceToggle, onStartTour }: {
  venue: Venue | null; posts: OwnPost[]; applications: IncomingApp[];
  loading: boolean; onNavigate: (s: Section) => void;
  geofenceEnabled: boolean; geofenceSaving: boolean; onGeofenceToggle: (val: boolean) => void;
  onStartTour: () => void;
}) {
  if (loading) return <OverviewSkeleton />;
  if (!venue) return <EmptyVenue onNavigate={onNavigate} />;

  const score = Math.round(venue.trustScore) || 86;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;
  const pendingCount = applications.filter(a => a.status === "PENDING").length;
  const activePosts  = posts.filter(p => p.status === "ACTIVE");
  const dims = trustDimensions(venue.venueTrustScore);

  return (
    <>
      <div className="dash-card p-6 flex flex-col sm:flex-row gap-6 items-start">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
            <circle cx="48" cy="48" r="40" fill="none" stroke="#f0efec" strokeWidth="8" />
            <circle cx="48" cy="48" r="40" fill="none" stroke="#f97316" strokeWidth="8"
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-black text-neutral-900">{score}</span>
            <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wide">trust</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="flex gap-2 flex-wrap mb-1">
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block pulse-dot" />Aktivan
            </span>
            <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {VENUE_TYPE_LABELS[venue.venueType] ?? venue.venueType}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {venue.logo ? (
              <Image src={venue.logo} alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-orange-200" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs flex-shrink-0">
                {getInitials(venue.name)}
              </div>
            )}
            <h2 className="text-2xl font-black text-neutral-900">{venue.name}</h2>
          </div>
          <p className="text-sm text-neutral-500 mt-0.5">{venue.address} · {venue.municipality}</p>
          <div className="flex gap-6 mt-4">
            {[
              { label: "Aktivni oglasi", value: String(activePosts.length) },
              { label: "Prijave",        value: String(applications.length) },
              { label: "Ocena",          value: score > 0 ? String(score) : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-xl font-black text-neutral-900">{value}</div>
                <div className="text-xs text-neutral-400 font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 self-start">
          <button onClick={() => onNavigate("new-post")} className="btn-dash-orange px-4 py-2 whitespace-nowrap">
            + Novi oglas
          </button>
          <button
            onClick={onStartTour}
            title="Pokreni vodič"
            className="flex items-center justify-center gap-1.5 text-xs text-neutral-400 hover:text-orange-400 transition-colors px-2 py-1"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 11V8M8 5.5V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Vodič
          </button>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="alert-card p-4 flex items-center gap-3 cursor-pointer" onClick={() => onNavigate("applications")}>
          <div className="relative w-4 h-4 flex-shrink-0">
            <span className="pulse-ring w-4 h-4" /><span className="pulse-ring-2 w-4 h-4" />
            <span className="relative w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center z-10">
              <span className="w-2 h-2 rounded-full bg-white" />
            </span>
          </div>
          <div className="flex-1">
            <span className="font-bold text-neutral-900 text-sm">{pendingCount} prijav{pendingCount === 1 ? "a čeka" : "e čekaju"} na odgovor</span>
            <p className="text-xs text-neutral-500">Kliknite da pregledite i odlučite</p>
          </div>
          <svg width="16" height="16" fill="none" stroke="#f97316" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="dash-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-neutral-900 text-sm">Aktivni oglasi</h3>
            <button onClick={() => onNavigate("posts")} className="text-xs text-orange-500 font-semibold hover:underline">Svi</button>
          </div>
          {activePosts.length === 0
            ? <p className="text-sm text-neutral-400 text-center py-4">Nema aktivnih oglasa</p>
            : <div className="flex flex-col gap-2">
                {activePosts.slice(0, 3).map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                    <div>
                      <div className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
                        {p.title}
                        {p.redAlert && <span className="text-[9px] font-black text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">⚡ RED</span>}
                      </div>
                      <div className="text-xs text-neutral-400">{ENGAGEMENT_LABELS[p.engagementType] ?? p.engagementType} · {p._count.applications} prijava</div>
                    </div>
                    <PostStatusBadge status={p.status} />
                  </div>
                ))}
              </div>
          }
        </div>

        <div className="dash-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-neutral-900 text-sm">Nedavne prijave</h3>
            <button onClick={() => onNavigate("applications")} className="text-xs text-orange-500 font-semibold hover:underline">Sve</button>
          </div>
          {applications.length === 0
            ? <p className="text-sm text-neutral-400 text-center py-4">Nema prijava</p>
            : <div className="flex flex-col gap-2">
                {applications.slice(0, 4).map(a => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-[11px] flex-shrink-0">
                        {getInitials(a.waiter.name)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-neutral-800">{a.waiter.name ?? "Konobar"}</div>
                        <div className="text-xs text-neutral-400">{a.jobPost.title}</div>
                      </div>
                    </div>
                    <AppStatusBadge status={a.status} />
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      <div className="dash-card p-5">
        <h3 className="font-bold text-neutral-900 text-sm mb-4">Trust Score — dimenzije</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {dims.map(d => (
            <div key={d.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-neutral-600 font-medium">{d.label}</span>
                <span className="font-bold text-neutral-900">{d.value || "—"}</span>
              </div>
              <div className="prog-track"><div className="prog-fill" style={{ width: `${d.value}%` }} /></div>
            </div>
          ))}
        </div>
        {!venue.venueTrustScore && (
          <p className="text-xs text-neutral-400 mt-3 text-center">Trust Score se računa nakon prvih recenzija</p>
        )}
      </div>

      <div className="dash-card p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-neutral-800">GPS geofencing za recenzije</div>
          <div className="text-xs text-neutral-400 mt-0.5">Gosti moraju biti fizički u lokalu da bi ostavili recenziju</div>
        </div>
        <button
          onClick={() => onGeofenceToggle(!geofenceEnabled)}
          disabled={geofenceSaving}
          aria-pressed={geofenceEnabled}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${geofenceEnabled ? "bg-orange-500" : "bg-neutral-300"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${geofenceEnabled ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>
    </>
  );
}

/* ── Nav ─────────────────────────────────────────────────────────────────── */

const HUB_SECTIONS    = new Set<Section>(["posts", "new-post", "applications", "waiters", "discover"]);
const REVIEW_SECTIONS = new Set<Section>(["reviews", "qr-review"]);

const NAV_ITEMS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Pregled",       icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg> },
  { key: "posts",    label: "Zapošljavanje", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg> },
  { key: "smene",    label: "Smene",         icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
  { key: "analitika", label: "Analitika",    icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg> },
  { key: "reviews",  label: "Recenzije",     icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg> },
];

const BOTTOM_NAV_ITEMS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: "profile",       label: "Profil lokala", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
  { key: "notifications", label: "Obaveštenja",   icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
];

/* ── Main dashboard ──────────────────────────────────────────────────────── */

export default function VenueDashboard() {
  const { data: session } = useSession();
  const { section, setSection, notifUnread, setNotifUnread, today } = useDashboardNav<Section>("overview");
  const { t } = useLang();
  const [venue, setVenue]               = useState<Venue | null>(null);
  const [posts, setPosts]               = useState<OwnPost[]>([]);
  const [applications, setApplications] = useState<IncomingApp[]>([]);
  const [shifts, setShifts]             = useState<VenueShift[]>([]);
  const [loading, setLoading]           = useState(true);
  const [inviteTarget, setInviteTarget] = useState<WaiterEntry | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<DashboardShellHandle>(null);
  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [geofenceSaving, setGeofenceSaving]   = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [venuesRes, postsRes, appsRes, shiftsRes] = await Promise.all([
      fetch("/api/venues"),
      fetch("/api/jobs"),
      fetch("/api/jobs/applications"),
      fetch("/api/shifts"),
    ]);
    if (venuesRes.ok) { const vs: Venue[] = await venuesRes.json(); setVenue(vs[0] ?? null); }
    if (postsRes.ok)  setPosts(await postsRes.json());
    if (appsRes.ok)   setApplications(await appsRes.json());
    if (shiftsRes.ok) setShifts(await shiftsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (venue) setGeofenceEnabled(venue.geofenceEnabled); }, [venue]);

  // Auto-refresh shifts every 30s when the smene section is active
  // Keeps pending clock-ins and marketplace claims visible without manual refresh
  useEffect(() => {
    if (section !== "smene") return;
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [section, fetchData]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileMenuOpen]);

  const { startTour } = useDashboardTour(session?.user);

  const handleStartTour = useCallback(() => {
    if (window.innerWidth < 768) {
      shellRef.current?.openMobile();
      setTimeout(startTour, 320);
    } else {
      startTour();
    }
  }, [startTour]);

  async function toggleGeofence(val: boolean) {
    if (!venue) return;
    setGeofenceEnabled(val);
    setGeofenceSaving(true);
    await fetch(`/api/venues/${venue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ geofenceEnabled: val }),
    });
    setGeofenceSaving(false);
  }

  const handleStatusChange = async (appId: string, status: string) => {
    await fetch(`/api/jobs/applications/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchData();
  };

  const handlePostStatusChange = async (postId: string, status: "ACTIVE" | "PAUSED") => {
    await fetch(`/api/jobs/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchData();
  };

  const userName        = session?.user?.name ?? venue?.name ?? "Lokal";
  const initials        = getInitials(userName);
  const pendingCount    = applications.filter(a => a.status === "PENDING").length;
  const acceptedWaiters = [...new Map(
    applications
      .filter(a => a.status === "ACCEPTED")
      .map(a => [a.waiter.id, { id: a.waiter.id, name: a.waiter.name }])
  ).values()];
  const navContent = (closeMenu?: () => void, idPrefix = "tour") => (
    <>
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV_ITEMS.map(item => (
          <button key={item.key}
            id={`${idPrefix}-nav-${item.key}`}
            onClick={() => { setSection(item.key); closeMenu?.(); }}
            className={`nav-item ${
              section === item.key ||
              (item.key === "posts"   && HUB_SECTIONS.has(section)) ||
              (item.key === "reviews" && REVIEW_SECTIONS.has(section))
                ? "active" : ""
            }`}>
            {item.icon}{t("venueNav", item.key)}
            {item.key === "posts" && pendingCount > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{pendingCount}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="px-3 pt-2 pb-1 flex flex-col gap-1 border-t border-white/10">
        {BOTTOM_NAV_ITEMS.map(item => (
          <button key={item.key}
            id={`${idPrefix}-nav-${item.key}`}
            onClick={() => { setSection(item.key); closeMenu?.(); }}
            className={`nav-item ${section === item.key ? "active" : ""}`}>
            {item.icon}{t("venueNav", item.key)}
            {item.key === "notifications" && notifUnread > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{notifUnread > 9 ? "9+" : notifUnread}</span>
            )}
          </button>
        ))}
      </div>
      <div className="px-3 py-4 border-t border-white/10">
        <div className="px-2 mb-3">
          <FlagSwitcher />
        </div>
        <div className="flex items-center gap-3 px-2 mb-3">
          {venue?.logo ? (
            <Image src={venue.logo} alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-orange-500/30" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-orange-900/40 flex items-center justify-center text-orange-300 font-bold text-sm flex-shrink-0 border border-orange-500/30">{initials}</div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{venue?.name ?? userName}</div>
            <div className="text-[11px] text-white/40 truncate">{t("venueUi", "role")}</div>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/" })} className="nav-item text-red-400/80 hover:bg-red-900/20 hover:text-red-300 w-full">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {t("venueUi", "signOut")}
        </button>
      </div>
    </>
  );

  return (
    <>
      <DashboardShell
        ref={shellRef}
        sectionTitle={t("venueTitles", section)}
        today={today}
        navContent={navContent}
        sidebarId="tour-sidebar-desktop"
        mobileSidebarId="tour-sidebar"
        topRight={
          <>
            <div id="tour-notifications">
              <NotificationBell
                dashboardPath="/dashboard/venue"
                onViewAll={() => setSection("notifications")}
                onUnreadChange={setNotifUnread}
              />
            </div>
            <div ref={profileMenuRef} className="relative">
              <button
                id="tour-profile-avatar"
                onClick={() => setProfileMenuOpen(o => !o)}
                className="focus:outline-none"
              >
                {venue?.logo ? (
                  <Image src={venue.logo} alt="" width={36} height={36} className="w-9 h-9 rounded-xl object-cover border border-orange-500/30 hover:border-orange-400/60 transition-colors" />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-300 font-bold text-sm border border-orange-500/30 hover:border-orange-400/60 transition-colors">{initials}</div>
                )}
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-white/10 bg-[#1a0e02] shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => { setSection("profile"); setProfileMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-orange-100/80 hover:bg-orange-500/10 hover:text-orange-300 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                    Profil
                  </button>
                  <button
                    onClick={() => { setSection("notifications"); setProfileMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-orange-100/80 hover:bg-orange-500/10 hover:text-orange-300 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>
                    {t("venueNav", "notifications")}
                    {notifUnread > 0 && (
                      <span className="ml-auto bg-orange-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">{notifUnread}</span>
                    )}
                  </button>
                  <div className="border-t border-white/10 mx-3" />
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400/80 hover:bg-red-900/20 hover:text-red-300 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" /></svg>
                    {t("venueUi", "signOut")}
                  </button>
                </div>
              )}
            </div>
          </>
        }
      >
        {section === "overview"      && <OverviewSection venue={venue} posts={posts} applications={applications} loading={loading} onNavigate={setSection} geofenceEnabled={geofenceEnabled} geofenceSaving={geofenceSaving} onGeofenceToggle={toggleGeofence} onStartTour={handleStartTour} />}
        {HUB_SECTIONS.has(section)   && <JobsHub section={section} posts={posts} applications={applications} loading={loading} onNavigate={setSection} onPostStatusChange={handlePostStatusChange} onAppStatusChange={handleStatusChange} onInvite={setInviteTarget} onNewPostSuccess={() => { fetchData(); setSection("posts"); }} venue={venue} />}
        {section === "smene"         && <VenueSmeneSection venue={venue} shifts={shifts} loading={loading} acceptedWaiters={acceptedWaiters} onRefresh={fetchData} />}
        {section === "analitika"     && <VenueAnalyticsSection venue={venue} />}
        {REVIEW_SECTIONS.has(section) && <ReviewsHub section={section} venue={venue} onNavigate={setSection} />}
        {section === "profile"       && <ProfileSection venue={venue} loading={loading} onVenueCreated={fetchData} geofenceEnabled={geofenceEnabled} geofenceSaving={geofenceSaving} onGeofenceToggle={toggleGeofence} onIsActiveToggle={(newIsActive) => setVenue(v => v ? { ...v, isActive: newIsActive } : v)} />}
        {section === "notifications" && <NotificationsSection />}
      </DashboardShell>

      {inviteTarget && (
        <InviteModal
          waiter={inviteTarget}
          posts={posts}
          onClose={() => setInviteTarget(null)}
          onSent={() => setInviteTarget(null)}
        />
      )}
    </>
  );
}
