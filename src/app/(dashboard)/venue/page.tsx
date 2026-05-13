"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import ImageUpload from "@/components/ui/ImageUpload";
import { QRCodeCanvas } from "qrcode.react";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { NotificationsSection } from "@/components/ui/NotificationsSection";
import { useDashboardTour } from "@/hooks/useDashboardTour";

type Section = "overview" | "posts" | "new-post" | "smene" | "applications" | "waiters" | "discover" | "reviews" | "qr-review" | "profile" | "notifications";
type AppFilter = "SVE" | "PENDING" | "SHORTLISTED" | "ACCEPTED" | "REJECTED";

type VenueShiftAssignment = {
  id: string;
  waiterId: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockInMethod: string | null;
  lateMinutes: number | null;
  pendingClockIn: boolean;
  waiter: { id: string; name: string | null };
};

type VenueSwapRequest = {
  id: string;
  status: string;
  requestedAt: string;
  fromAssignment: { id: string; waiter: { id: string; name: string | null } };
  toWaiter: { id: string; name: string | null };
};

type VenueShift = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  scheduledStart: string | null;
  role: string | null;
  requiredCount: number;
  tipEstimate: number | null;
  pay: number | null;
  briefingNote: string | null;
  notes: string | null;
  status: string;
  swapLocked: boolean;
  assignments: VenueShiftAssignment[];
  swapRequests: VenueSwapRequest[];
};

type TemplateMeta = { type?: "morning" | "evening"; label?: string; shift?: "1" | "2" };
type ShiftTemplate = {
  id: string;
  venueId: string;
  name: string;
  dayOfWeek: number | null;
  weekdaysOnly: boolean;
  metadata: TemplateMeta | null;
  startTime: string;
  endTime: string;
  requiredCount: number;
  role: string | null;
  pay: number | null;
};

const DAYS_SR   = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
const MONTHS_SR = ["Januar", "Februar", "Mart", "April", "Maj", "Jun",
                   "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"];

/* ── API types ────────────────────────────────────────────────────────────── */

type Venue = {
  id: string;
  name: string;
  address: string;
  municipality: string;
  city: string;
  venueType: string;
  capacity: number | null;
  trustScore: number;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  description: string | null;
  priceRangeMin: number | null;
  priceRangeMax: number | null;
  geofenceEnabled: boolean;
  images: string[];
  logo?: string | null;
  headWaiterId: string | null;
  headWaiter: { id: string; name: string | null } | null;
  _count: { jobPosts: number };
  venueTrustScore: {
    atmosphere: number; organization: number; pay: number;
    tips: number; hygieneStandards: number; management: number;
    composite: number; sampleSize: number;
  } | null;
};

type VenueReview = {
  id: string;
  direction: string;
  status: string;
  overallRating: number;
  comment: string | null;
  guestHandle: string | null;
  createdAt: string;
  publishedAt: string | null;
  author: { name: string | null; verificationTier: string } | null;
  subject: { name: string | null; image: string | null } | null;
  ratingAtmosphere: number | null;
  ratingOrganization: number | null;
  ratingHygieneWork: number | null;
  ratingFriendliness: number | null;
  ratingGuestSpeed: number | null;
  ratingAttentiveness: number | null;
};

type OwnPost = {
  id: string;
  title: string;
  engagementType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  redAlert: boolean;
  status: string;
  createdAt: string;
  venue: { id: string; name: string };
  _count: { applications: number };
};

type WaiterEntry = {
  id: string;
  name: string | null;
  verificationTier: string;
  waiterPassport: {
    score: number;
    skills: string[];
    languages: string[];
    yearsExperience: number;
    sanitaryBookValid: boolean;
    currentlyAvailable: boolean;
    badges: string[];
    bio: string | null;
    passportTier?: string;
    subscriptionExpiresAt?: string | null;
  } | null;
};

type IncomingApp = {
  id: string;
  status: string;
  appliedAt: string;
  jobPost: { id: string; title: string; venueId: string };
  waiter: {
    id: string;
    name: string | null;
    verificationTier: string;
    waiterPassport: {
      score: number;
      badges: string[];
      sanitaryBookValid: boolean;
      currentlyAvailable: boolean;
    } | null;
  };
};

/* ── Static placeholder data (no API yet) ────────────────────────────────── */

const REVIEWS = [
  { id: 1, waiter: "Jovana Milić",    rating: 5, date: "15 Apr 2026", text: "Izuzetna profesionalka. Smirena u najluđim noćima, gosti je obožavaju." },
  { id: 2, waiter: "Marko Nikolić",   rating: 5, date: "2 Apr 2026",  text: "Tačan, brz, komunikativan. Bez ikakvih primedbi — preporučujem svim lokalima." },
  { id: 3, waiter: "Stefan Đorđević", rating: 3, date: "18 Mar 2026", text: "Solidan rad, ali kasnio 15 minuta na početak smene." },
];

/* ── Utility ──────────────────────────────────────────────────────────────── */

const ENGAGEMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Stalno", SEASONAL: "Sezonski", WEEKEND: "Vikend", CELEBRATION: "Slavlje",
};

const VENUE_TYPE_LABELS: Record<string, string> = {
  RESTAURANT: "Restoran", CAFE: "Kafić", BAR: "Bar",
  CATERING: "Ketering", HOTEL: "Hotel", EVENT: "Event",
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function formatSalary({ salaryMin, salaryMax, engagementType }: Pick<OwnPost, "salaryMin" | "salaryMax" | "engagementType">): string {
  if (!salaryMin && !salaryMax) return "Po dogovoru";
  const sfx = engagementType === "FULL_TIME" ? "/mes" : "/sm";
  if (salaryMin && salaryMax) return `${salaryMin.toLocaleString("sr-RS")} – ${salaryMax.toLocaleString("sr-RS")} RSD${sfx}`;
  if (salaryMin) return `od ${salaryMin.toLocaleString("sr-RS")} RSD${sfx}`;
  return `do ${salaryMax!.toLocaleString("sr-RS")} RSD${sfx}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short", year: "numeric" });
}

function trustDimensions(ts: Venue["venueTrustScore"]): { label: string; value: number }[] {
  if (!ts) return [
    { label: "Atmosfera", value: 0 }, { label: "Organizacija", value: 0 },
    { label: "Isplata", value: 0 },   { label: "Bakšiš sistem", value: 0 },
    { label: "Higijena", value: 0 },  { label: "Menadžment", value: 0 },
  ];
  return [
    { label: "Atmosfera",    value: Math.round(ts.atmosphere) },
    { label: "Organizacija", value: Math.round(ts.organization) },
    { label: "Isplata",      value: Math.round(ts.pay) },
    { label: "Bakšiš sistem",value: Math.round(ts.tips) },
    { label: "Higijena",     value: Math.round(ts.hygieneStandards) },
    { label: "Menadžment",   value: Math.round(ts.management) },
  ];
}

/* ── Helper components ────────────────────────────────────────────────────── */

function PostStatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE")  return <span className="badge-accepted text-xs font-semibold px-2.5 py-0.5 rounded-full">Aktivan</span>;
  if (status === "PAUSED")  return <span className="badge-pending text-xs font-semibold px-2.5 py-0.5 rounded-full">Pauziran</span>;
  if (status === "FILLED")  return <span className="badge-rejected text-xs font-semibold px-2.5 py-0.5 rounded-full">Popunjen</span>;
  return <span className="badge-rejected text-xs font-semibold px-2.5 py-0.5 rounded-full">{status}</span>;
}

function AppStatusBadge({ status }: { status: string }) {
  if (status === "ACCEPTED")    return <span className="badge-accepted text-xs font-semibold px-2.5 py-0.5 rounded-full">Prihvaćen</span>;
  if (status === "REJECTED")    return <span className="badge-rejected text-xs font-semibold px-2.5 py-0.5 rounded-full">Odbijen</span>;
  if (status === "SHORTLISTED") return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd" }}>Shortlist</span>;
  return <span className="badge-pending text-xs font-semibold px-2.5 py-0.5 rounded-full">Na čekanju</span>;
}

function TierBadge({ tier }: { tier: string }) {
  if (tier === "GOLD")   return <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">🥇 GOLD</span>;
  if (tier === "SILVER") return <span className="bg-neutral-100 text-neutral-600 text-[10px] font-bold px-2 py-0.5 rounded-full">🥈 SILVER</span>;
  return null;
}

function PassportTierBadge({ tier, expiresAt }: { tier?: string; expiresAt?: string | null }) {
  if (!tier || tier === "FREE") return null;
  if (expiresAt && new Date(expiresAt) <= new Date()) return null;
  if (tier === "PRO_PLUS") return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-500 text-white tracking-wide">PRO+</span>;
  return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-300">PRO</span>;
}

function Stars({ n }: { n: number }) {
  return <span className="text-amber-400 text-sm">{"★".repeat(n)}{"☆".repeat(5 - n)}</span>;
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 85 ? "#f97316" : score >= 70 ? "#eab308" : "#6b7280";
  return <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>{Math.round(score)}</span>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );
}

function EmptyVenue({ onNavigate }: { onNavigate: (s: Section) => void }) {
  return (
    <div className="dash-card p-10 flex flex-col items-center gap-4 text-center">
      <div className="text-4xl">🏠</div>
      <div>
        <h3 className="font-bold text-neutral-900">Nemaš registrovan lokal</h3>
        <p className="text-sm text-neutral-400 mt-1">Dodaj lokal kako bi mogao da objaviš oglas.</p>
      </div>
      <button onClick={() => onNavigate("profile")} className="btn-dash-orange px-5 py-2">Dodaj lokal</button>
    </div>
  );
}

/* ── Section: Overview ───────────────────────────────────────────────────── */

function OverviewSection({ venue, posts, applications, loading, onNavigate, geofenceEnabled, geofenceSaving, onGeofenceToggle, onStartTour }: {
  venue: Venue | null; posts: OwnPost[]; applications: IncomingApp[];
  loading: boolean; onNavigate: (s: Section) => void;
  geofenceEnabled: boolean; geofenceSaving: boolean; onGeofenceToggle: (val: boolean) => void;
  onStartTour: () => void;
}) {
  if (loading) return <Spinner />;
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

/* ── Section: Posts ──────────────────────────────────────────────────────── */

function PostsSection({ posts, loading, onNavigate, onStatusChange }: {
  posts: OwnPost[]; loading: boolean;
  onNavigate: (s: Section) => void;
  onStatusChange: (id: string, status: "ACTIVE" | "PAUSED") => Promise<void>;
}) {
  const [changing, setChanging] = useState<string | null>(null);

  const handleToggle = async (id: string, current: string) => {
    const next = current === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setChanging(id);
    await onStatusChange(id, next as "ACTIVE" | "PAUSED");
    setChanging(null);
  };

  if (loading) return <Spinner />;
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="font-black text-white">Moji oglasi</h2>
        <button onClick={() => onNavigate("new-post")} className="btn-dash-orange px-4 py-2">+ Novi oglas</button>
      </div>
      {posts.length === 0
        ? <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nema oglasa — klikni &quot;+ Novi oglas&quot; da počneš</div>
        : <div className="flex flex-col gap-3">
            {posts.map(p => (
              <div key={p.id} className="dash-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-neutral-900">{p.title}</span>
                      {p.redAlert && <span className="text-[10px] font-black text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">⚡ Red Alert</span>}
                      <PostStatusBadge status={p.status} />
                    </div>
                    <div className="text-sm text-neutral-500 mt-0.5">{ENGAGEMENT_LABELS[p.engagementType] ?? p.engagementType} · {formatSalary(p)}</div>
                    <div className="text-xs text-neutral-400 mt-1">
                      Objavljen {formatDate(p.createdAt)} · <span className="font-semibold text-neutral-600">{p._count.applications} prijava</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {(p.status === "ACTIVE" || p.status === "PAUSED") && (
                      <button
                        onClick={() => handleToggle(p.id, p.status)}
                        disabled={changing === p.id}
                        className={`px-3 py-1.5 text-xs disabled:opacity-50 ${p.status === "ACTIVE" ? "btn-dash-outline" : "btn-dash-orange"}`}
                      >
                        {changing === p.id ? "..." : p.status === "ACTIVE" ? "Pauziraj" : "Aktiviraj"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
    </>
  );
}

/* ── Section: New Post ───────────────────────────────────────────────────── */

function NewPostSection({ venue, onSuccess, onBack }: {
  venue: Venue | null;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [form, setForm] = useState({
    title: "", description: "", engagementType: "FULL_TIME", tipSystem: "INDIVIDUAL",
    salaryMin: "", salaryMax: "", sanitaryRequired: false, redAlert: false,
    redAlertNote: "", startDate: "", endDate: "", applicationDeadline: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!venue) return <EmptyVenue onNavigate={onBack} />;

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venueId: venue!.id,
        title: form.title,
        description: form.description,
        engagementType: form.engagementType,
        tipSystem: form.tipSystem,
        salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
        sanitaryRequired: form.sanitaryRequired,
        redAlert: form.redAlert,
        redAlertNote: form.redAlertNote || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        applicationDeadline: form.applicationDeadline || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? "Greška pri kreiranju oglasa.");
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack}
          className="btn-dash-outline px-3 py-1.5 text-sm flex items-center gap-1">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
          Nazad
        </button>
        <h2 className="font-black text-white">Novi oglas</h2>
      </div>

      <div className="dash-card p-6 flex flex-col gap-5">
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Naziv pozicije *</label>
          <input type="text" required value={form.title}
            onChange={e => set("title", e.target.value)}
            placeholder="npr. Konobar/ica za vikend" className="auth-input" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Opis *</label>
          <textarea required value={form.description}
            onChange={e => set("description", e.target.value)}
            placeholder="Opišite poziciju, uslove rada, iskustvo..." rows={4}
            className="auth-input resize-none" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Tip angažmana *</label>
            <select required value={form.engagementType}
              onChange={e => set("engagementType", e.target.value)} className="auth-input">
              <option value="FULL_TIME">Stalno</option>
              <option value="SEASONAL">Sezonski</option>
              <option value="WEEKEND">Vikend</option>
              <option value="CELEBRATION">Slavlje</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Bakšiš sistem *</label>
            <select required value={form.tipSystem}
              onChange={e => set("tipSystem", e.target.value)} className="auth-input">
              <option value="INDIVIDUAL">Individualni (konobar zadržava)</option>
              <option value="SHARED">Zajednički fond</option>
              <option value="VENUE_POLICY">Politika lokala</option>
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Plata od (RSD)</label>
            <input type="number" min={0} value={form.salaryMin}
              onChange={e => set("salaryMin", e.target.value)}
              placeholder="npr. 60 000" className="auth-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Plata do (RSD)</label>
            <input type="number" min={0} value={form.salaryMax}
              onChange={e => set("salaryMax", e.target.value)}
              placeholder="npr. 90 000" className="auth-input" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Datum početka</label>
            <input type="date" value={form.startDate}
              onChange={e => set("startDate", e.target.value)} className="auth-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Datum završetka</label>
            <input type="date" value={form.endDate}
              onChange={e => set("endDate", e.target.value)} className="auth-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Rok prijave</label>
            <input type="date" value={form.applicationDeadline}
              onChange={e => set("applicationDeadline", e.target.value)} className="auth-input" />
          </div>
        </div>
        <div className="flex flex-col gap-3 pt-1">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={form.sanitaryRequired}
              onChange={e => set("sanitaryRequired", e.target.checked)}
              className="w-4 h-4 rounded accent-orange-500" />
            <span className="text-sm text-neutral-700">Sanitarna knjižica obavezna</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={form.redAlert}
              onChange={e => set("redAlert", e.target.checked)}
              className="w-4 h-4 rounded accent-orange-500" />
            <span className="text-sm text-neutral-700">⚡ Red Alert — hitna potreba, oglas se ističe</span>
          </label>
        </div>
        {form.redAlert && (
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Napomena za Red Alert</label>
            <input type="text" value={form.redAlertNote}
              onChange={e => set("redAlertNote", e.target.value)}
              placeholder="npr. Potreban odmah za vikend" className="auth-input" />
          </div>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>
      )}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-dash-orange px-6 py-2.5 disabled:opacity-60">
          {saving ? "Objavljivanje..." : "Objavi oglas"}
        </button>
        <button type="button" onClick={onBack} className="btn-dash-outline px-6 py-2.5">Otkaži</button>
      </div>
    </form>
  );
}

/* ── Section: Applications ───────────────────────────────────────────────── */

function ApplicationsSection({ applications, loading, onStatusChange }: {
  applications: IncomingApp[]; loading: boolean;
  onStatusChange: (id: string, status: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState<AppFilter>("SVE");
  const [changing, setChanging] = useState<string | null>(null);
  if (loading) return <Spinner />;

  const filtered = filter === "SVE" ? applications : applications.filter(a => a.status === filter);
  const pendingCount = applications.filter(a => a.status === "PENDING").length;
  const tabs: { key: AppFilter; label: string }[] = [
    { key: "SVE", label: "Sve" }, { key: "PENDING", label: "Na čekanju" },
    { key: "SHORTLISTED", label: "Shortlist" }, { key: "ACCEPTED", label: "Prihvaćene" },
    { key: "REJECTED", label: "Odbijene" },
  ];

  const handleChange = async (id: string, status: string) => {
    setChanging(id);
    await onStatusChange(id, status);
    setChanging(null);
  };

  return (
    <>
      <h2 className="font-black text-white">Prijave konobara</h2>
      <div className="bg-neutral-100 rounded-xl p-1 flex gap-1 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`tab-btn text-xs font-semibold px-3 py-1.5 rounded-lg ${filter === t.key ? "active" : "text-neutral-500"}`}>
            {t.label}
            {t.key === "PENDING" && pendingCount > 0 && (
              <span className="ml-1 bg-orange-500 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full inline-flex items-center justify-center">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>
      {filtered.length === 0
        ? <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nema prijava</div>
        : <div className="flex flex-col gap-3">
            {filtered.map(a => (
              <div key={a.id} className="dash-card p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold flex-shrink-0">
                    {getInitials(a.waiter.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-neutral-900">{a.waiter.name ?? "Konobar"}</span>
                      <TierBadge tier={a.waiter.verificationTier} />
                      {a.waiter.waiterPassport && <ScorePill score={a.waiter.waiterPassport.score} />}
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">Oglas: {a.jobPost.title} · {formatDate(a.appliedAt)}</div>
                    {a.waiter.waiterPassport?.badges && a.waiter.waiterPassport.badges.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-2">
                        {a.waiter.waiterPassport.badges.slice(0, 3).map(b => (
                          <span key={b} className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-full font-medium">{b}</span>
                        ))}
                      </div>
                    )}
                    {a.waiter.waiterPassport?.sanitaryBookValid && (
                      <span className="inline-block mt-1 text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Sanitarna ✓</span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <AppStatusBadge status={a.status} />
                    {(a.status === "PENDING" || a.status === "SHORTLISTED") && (
                      <div className="flex gap-1.5">
                        <button onClick={() => handleChange(a.id, "ACCEPTED")} disabled={changing === a.id}
                          className="btn-dash-orange px-3 py-1.5 text-[11px] disabled:opacity-50">
                          {changing === a.id ? "..." : "Prihvati"}
                        </button>
                        <button onClick={() => handleChange(a.id, "REJECTED")} disabled={changing === a.id}
                          className="btn-dash-outline px-3 py-1.5 text-[11px] disabled:opacity-50">
                          Odbij
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
    </>
  );
}

/* ── InviteModal ─────────────────────────────────────────────────────────── */

function InviteModal({ waiter, posts, onClose, onSent }: {
  waiter: WaiterEntry; posts: OwnPost[]; onClose: () => void; onSent: () => void;
}) {
  const [jobPostId, setJobPostId] = useState(posts.find(p => p.status === "ACTIVE")?.id ?? "");
  const [message, setMessage]     = useState("");
  const [sending, setSending]     = useState(false);
  const [error, setError]         = useState("");
  const [done, setDone]           = useState(false);

  const activePosts = posts.filter(p => p.status === "ACTIVE");

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!jobPostId) { setError("Odaberi oglas"); return; }
    setSending(true); setError("");
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waiterId: waiter.id, jobPostId, message: message || undefined }),
    });
    setSending(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error === "Invite already sent" ? "Pozivnica je već poslata ovom konobaru za ovaj oglas." : (data.error ?? "Greška"));
      return;
    }
    setDone(true);
    setTimeout(onSent, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl mx-4">
        {done ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg width="24" height="24" fill="none" stroke="#15803d" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <p className="font-bold text-neutral-900">Pozivnica poslata!</p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold flex-shrink-0">
                {getInitials(waiter.name)}
              </div>
              <div>
                <div className="font-bold text-neutral-900">{waiter.name ?? "Konobar"}</div>
                <div className="text-xs text-neutral-400">Slanje pozivnice</div>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Oglas</label>
              {activePosts.length === 0
                ? <p className="text-xs text-neutral-400">Nemaš aktivnih oglasa.</p>
                : <select value={jobPostId} onChange={e => setJobPostId(e.target.value)} className="auth-input">
                    {activePosts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
              }
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Poruka (opciono)</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                placeholder="Videli smo tvoj profil i mislimo da bi bio odličan fit za naš tim..."
                className="auth-input resize-none" />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-dash-outline flex-1 py-2.5">Otkaži</button>
              <button type="submit" disabled={sending || activePosts.length === 0}
                className="btn-dash-orange flex-1 py-2.5 disabled:opacity-50">
                {sending ? "Slanje..." : "Pošalji pozivnicu"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── Section: Discover ───────────────────────────────────────────────────── */

function DiscoverSection({ onInvite }: { posts: OwnPost[]; onInvite: (w: WaiterEntry) => void }) {
  const [waiters, setWaiters]           = useState<WaiterEntry[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterAvailable, setFilterAvailable] = useState(false);
  const [filterMinScore, setFilterMinScore]   = useState(0);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterAvailable) params.set("available", "true");
    if (filterMinScore > 0) params.set("minScore", String(filterMinScore));
    setLoading(true);
    fetch(`/api/waiters?${params}`)
      .then(r => r.json())
      .then(data => { setWaiters(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filterAvailable, filterMinScore]);

  return (
    <>
      <h2 className="font-black text-white">Pronađi konobara</h2>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilterAvailable(p => !p)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${filterAvailable ? "bg-green-500 text-white border-green-500" : "bg-white text-neutral-600 border-neutral-200 hover:border-green-400"}`}>
          Samo dostupni
        </button>
        {[0, 50, 70, 85].map(score => (
          <button key={score} onClick={() => setFilterMinScore(score)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${filterMinScore === score ? "bg-orange-500 text-white border-orange-500" : "bg-white text-neutral-600 border-neutral-200 hover:border-orange-300"}`}>
            {score === 0 ? "Svi" : `Score ${score}+`}
          </button>
        ))}
      </div>
      {loading ? <Spinner /> : waiters.length === 0
        ? <div className="dash-card p-10 text-center text-neutral-400 text-sm">Nema konobara koji odgovaraju filteru</div>
        : <div className="grid gap-3 sm:grid-cols-2">
            {waiters.map(w => (
              <div key={w.id} className="dash-card p-5">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-lg flex-shrink-0">
                    {getInitials(w.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-neutral-900">{w.name ?? "Konobar"}</span>
                      <TierBadge tier={w.verificationTier} />
                      <PassportTierBadge tier={w.waiterPassport?.passportTier} expiresAt={w.waiterPassport?.subscriptionExpiresAt} />
                    </div>
                    {w.waiterPassport && (
                      <>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <ScorePill score={w.waiterPassport.score} />
                          {w.waiterPassport.currentlyAvailable
                            ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Dostupan</span>
                            : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-400">Zauzet</span>
                          }
                          {w.waiterPassport.sanitaryBookValid && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Sanitarna ✓</span>
                          )}
                        </div>
                        {w.waiterPassport.skills.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-2">
                            {w.waiterPassport.skills.slice(0, 4).map(s => (
                              <span key={s} className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-full font-medium">{s}</span>
                            ))}
                          </div>
                        )}
                        {w.waiterPassport.yearsExperience > 0 && (
                          <div className="text-xs text-neutral-400 mt-1">{w.waiterPassport.yearsExperience}g iskustva</div>
                        )}
                      </>
                    )}
                  </div>
                  <button onClick={() => onInvite(w)} className="btn-dash-orange px-3 py-1.5 text-[11px] flex-shrink-0 mt-1">
                    Pozovi
                  </button>
                </div>
              </div>
            ))}
          </div>
      }
    </>
  );
}

/* ── Section: Waiters ────────────────────────────────────────────────────── */

function WaitersSection({ applications, loading, onInvite, venue }: { applications: IncomingApp[]; loading: boolean; onInvite: (w: WaiterEntry) => void; venue: Venue | null }) {
  if (loading) return <Spinner />;
  const unique = Object.values(
    applications.reduce<Record<string, IncomingApp>>((acc, a) => {
      if (!acc[a.waiter.id]) acc[a.waiter.id] = a;
      return acc;
    }, {})
  );
  return (
    <>
      <h2 className="font-black text-white">Konobari koji su se prijavili</h2>
      {unique.length === 0
        ? <div className="dash-card p-10 text-center text-neutral-400 text-sm">Još nema prijava</div>
        : <div className="grid gap-3 sm:grid-cols-2">
            {unique.map(a => (
              <div key={a.waiter.id} className="dash-card p-5">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold flex-shrink-0">
                    {getInitials(a.waiter.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-neutral-900">{a.waiter.name ?? "Konobar"}</span>
                      <TierBadge tier={a.waiter.verificationTier} />
                      {venue?.headWaiterId === a.waiter.id && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                          <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                          Šef konobara
                        </span>
                      )}
                    </div>
                    {a.waiter.waiterPassport && (
                      <div className="flex items-center gap-2 mt-1">
                        <ScorePill score={a.waiter.waiterPassport.score} />
                        {a.waiter.waiterPassport.currentlyAvailable
                          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Dostupan</span>
                          : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-400">Zauzet</span>
                        }
                      </div>
                    )}
                  </div>
                  <button onClick={() => onInvite({
                    id: a.waiter.id, name: a.waiter.name, verificationTier: a.waiter.verificationTier,
                    waiterPassport: a.waiter.waiterPassport ? {
                      score: a.waiter.waiterPassport.score, skills: [], languages: [],
                      yearsExperience: 0, sanitaryBookValid: a.waiter.waiterPassport.sanitaryBookValid,
                      currentlyAvailable: a.waiter.waiterPassport.currentlyAvailable,
                      badges: a.waiter.waiterPassport.badges, bio: null,
                    } : null,
                  })} className="btn-dash-orange px-3 py-1.5 text-[11px] flex-shrink-0">Pozovi</button>
                </div>
              </div>
            ))}
          </div>
      }
    </>
  );
}

/* ── Section: Reviews ────────────────────────────────────────────────────── */

function ReviewStatusBadge({ status }: { status: string }) {
  if (status === "PENDING")  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Čeka objavu</span>;
  if (status === "DISPUTED") return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Sporno</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Objavljeno</span>;
}

function starsText(rating: number): string {
  const n = Math.round(rating / 20);
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short", year: "numeric" });
}

function ReviewsSection({ venue }: { venue: Venue | null }) {
  const [reviews, setReviews]   = useState<VenueReview[]>([]);
  const [loadingR, setLoadingR] = useState(true);
  const [moderating, setModerating] = useState<string | null>(null);

  useEffect(() => {
    if (!venue) { setLoadingR(false); return; }
    fetch(`/api/venues/${venue.id}/reviews`)
      .then(r => r.ok ? r.json() : [])
      .then((data: VenueReview[]) => {
        setReviews(data.filter(r => r.direction === "WAITER_TO_VENUE" && r.status !== "REMOVED"));
        setLoadingR(false);
      })
      .catch(() => setLoadingR(false));
  }, [venue?.id]);

  async function handleModerate(reviewId: string, action: "approve" | "reject") {
    setModerating(reviewId);
    const res = await fetch(`/api/reviews/${reviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setModerating(null);
    if (res.ok) {
      setReviews(prev => action === "reject"
        ? prev.filter(r => r.id !== reviewId)
        : prev.map(r => r.id === reviewId ? { ...r, status: "PUBLISHED" } : r)
      );
    }
  }

  return (
    <>
      <h2 className="font-black text-white">Recenzije</h2>

      {/* Real reviews from DB */}
      <div className="dash-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-neutral-900 text-sm">Recenzije konobara o lokalu</h3>
          {!loadingR && <span className="text-xs text-neutral-400">{reviews.length} primljeno</span>}
        </div>
        {loadingR ? (
          <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-6">Još nema recenzija konobara.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {reviews.map(r => (
              <div key={r.id} className="border-b border-neutral-100 last:border-0 pb-4 last:pb-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-neutral-900 text-sm">{r.author?.name ?? "Konobar"}</span>
                    <ReviewStatusBadge status={r.status} />
                  </div>
                  <span className="text-xs text-neutral-400 flex-shrink-0">{shortDate(r.createdAt)}</span>
                </div>
                <div className="text-orange-400 text-sm tracking-wide mb-1">{starsText(r.overallRating)}</div>
                {r.comment && <p className="text-sm text-neutral-600 leading-relaxed">{r.comment}</p>}
                {(r.ratingAtmosphere || r.ratingOrganization || r.ratingHygieneWork) && (
                  <div className="flex gap-3 mt-2 flex-wrap">
                    {r.ratingAtmosphere   && <span className="text-xs text-neutral-400">Atmosfera {starsText(r.ratingAtmosphere)}</span>}
                    {r.ratingOrganization && <span className="text-xs text-neutral-400">Organizacija {starsText(r.ratingOrganization)}</span>}
                    {r.ratingHygieneWork  && <span className="text-xs text-neutral-400">Higijena {starsText(r.ratingHygieneWork)}</span>}
                  </div>
                )}
                {r.status === "PENDING" && (
                  <div className="flex gap-2 mt-2">
                    <button disabled={moderating === r.id} onClick={() => handleModerate(r.id, "approve")}
                      className="text-xs font-semibold px-3 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 transition-colors">
                      {moderating === r.id ? "..." : "Objavi"}
                    </button>
                    <button disabled={moderating === r.id} onClick={() => handleModerate(r.id, "reject")}
                      className="text-xs font-semibold px-3 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 transition-colors">
                      Odbaci
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Static demo data */}
      <div className="dash-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-bold text-neutral-900 text-sm">Demo recenzije</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">DEMO</span>
        </div>
        <div className="flex flex-col gap-4">
          {REVIEWS.map(r => (
            <div key={r.id} className="border-b border-neutral-100 last:border-0 pb-4 last:pb-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-bold text-neutral-900 text-sm">{r.waiter}</span>
                <span className="text-xs text-neutral-400 flex-shrink-0">{r.date}</span>
              </div>
              <div className="text-orange-400 text-sm tracking-wide mb-1">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
              <p className="text-sm text-neutral-600 leading-relaxed">{r.text}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ── Section: QR Reviews ─────────────────────────────────────────────────── */

function QrReviewSection({ venue }: { venue: Venue | null }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [guestReviews, setGuestReviews] = useState<VenueReview[]>([]);
  const [loadingGR, setLoadingGR] = useState(true);
  const [moderating, setModerating] = useState<string | null>(null);

  useEffect(() => {
    if (!venue) { setLoadingGR(false); return; }
    fetch(`/api/venues/${venue.id}/reviews`)
      .then(r => r.ok ? r.json() : [])
      .then((data: VenueReview[]) => {
        setGuestReviews(data.filter(r =>
          (r.direction === "GUEST_TO_VENUE" || r.direction === "GUEST_TO_WAITER") && r.status !== "REMOVED"
        ));
        setLoadingGR(false);
      })
      .catch(() => setLoadingGR(false));
  }, [venue?.id]);

  async function handleModerate(reviewId: string, action: "approve" | "reject") {
    setModerating(reviewId);
    const res = await fetch(`/api/reviews/${reviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setModerating(null);
    if (res.ok) {
      setGuestReviews(prev => action === "reject"
        ? prev.filter(r => r.id !== reviewId)
        : prev.map(r => r.id === reviewId ? { ...r, status: "PUBLISHED" } : r)
      );
    }
  }

  if (!venue) {
    return (
      <>
        <h2 className="font-black text-white">QR Recenzije</h2>
        <div className="dash-card p-10 text-center text-neutral-400 text-sm">
          Prvo kreirajte profil lokala da biste generisali QR kod.
        </div>
      </>
    );
  }

  const venueSafe: Venue = venue;
  const reviewUrl = typeof window !== "undefined"
    ? `${window.location.origin}/review/${venueSafe.id}`
    : `/review/${venueSafe.id}`;

  async function copyLink() {
    await navigator.clipboard.writeText(reviewUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadQr() {
    const canvas = wrapperRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `qr-recenzija-${venueSafe.name.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function printQr() {
    const canvas = wrapperRef.current?.querySelector("canvas");
    if (!canvas) return;
    const img = canvas.toDataURL("image/png");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>QR — ${venueSafe.name}</title><style>
        body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; gap: 16px; }
        img { width: 280px; height: 280px; }
        p { font-size: 14px; color: #555; text-align: center; max-width: 280px; }
        h2 { font-size: 20px; font-weight: 900; margin: 0; }
      </style></head><body>
        <h2>${venueSafe.name}</h2>
        <img src="${img}" />
        <p>Skenirajte QR kod i ostavite recenziju konobara koji vas je uslužio.</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  }

  return (
    <>
      <div className="dash-card p-4 sm:p-6 flex flex-col sm:flex-row gap-6">
        {/* QR code — centered on mobile, top-aligned on sm+ */}
        <div ref={wrapperRef} className="flex-shrink-0 flex flex-col items-center gap-3 self-center sm:self-start">
          <div className="p-3 sm:p-4 bg-white border border-neutral-200 rounded-2xl">
            <QRCodeCanvas
              value={reviewUrl}
              size={180}
              bgColor="#ffffff"
              fgColor="#1a1a1a"
              level="M"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={downloadQr}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors">
              Preuzmi PNG
            </button>
            <button onClick={printQr}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors">
              Štampaj
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4 flex-1 min-w-0">
          <div>
            <h3 className="font-bold text-neutral-900 break-words">Gostinska recenzija za {venueSafe.name}</h3>
            <p className="text-sm text-neutral-500 mt-1 leading-relaxed">
              Postavite ovaj QR kod na sto, šank ili ulaz. Gosti skeniraju, biraju konobara i ostavljaju ocenu — bez registracije.
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold text-neutral-500 mb-1.5">Link za recenziju</div>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 min-w-0 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-600 font-mono truncate flex items-center">
                {reviewUrl}
              </div>
              <button onClick={copyLink}
                className={`flex-shrink-0 text-xs font-bold px-3 py-2 rounded-xl transition-colors ${copied ? "bg-green-100 text-green-700" : "bg-orange-500 text-white hover:bg-orange-600"}`}>
                {copied ? "✓" : "Kopiraj"}
              </button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex flex-col gap-1.5">
            <div className="text-xs font-black text-amber-700 uppercase tracking-wider">Kako funkcioniše</div>
            <ul className="text-xs text-amber-700 flex flex-col gap-1.5">
              <li className="flex items-start gap-2"><span className="flex-shrink-0 font-bold">1.</span><span>Gost skenira QR i bira konobara</span></li>
              <li className="flex items-start gap-2"><span className="flex-shrink-0 font-bold">2.</span><span>Ocenjuje ljubaznost, brzinu i pažljivost (1–5 ★)</span></li>
              <li className="flex items-start gap-2"><span className="flex-shrink-0 font-bold">3.</span><span>GPS potvrđuje da je gost u lokalu</span></li>
              <li className="flex items-start gap-2"><span className="flex-shrink-0 font-bold">4.</span><span>Recenzija se objavljuje za 2h i utiče na skor konobara</span></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Guest reviews feed */}
      <div className="dash-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-neutral-900 text-sm">Gostinske recenzije</h3>
          {!loadingGR && <span className="text-xs text-neutral-400">{guestReviews.length} primljeno</span>}
        </div>
        {loadingGR ? (
          <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : guestReviews.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-6">Još nema gostinskih recenzija.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {guestReviews.map(r => (
              <div key={r.id} className="border-b border-neutral-100 last:border-0 pb-4 last:pb-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-neutral-900 text-sm">
                      {r.direction === "GUEST_TO_WAITER"
                        ? (r.subject?.name ?? "Konobar")
                        : (r.guestHandle ?? "Gost")}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.direction === "GUEST_TO_VENUE" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                      {r.direction === "GUEST_TO_VENUE" ? "Lokal" : "Konobar"}
                    </span>
                    <ReviewStatusBadge status={r.status} />
                  </div>
                  <span className="text-xs text-neutral-400 flex-shrink-0">{shortDate(r.createdAt)}</span>
                </div>
                {r.direction === "GUEST_TO_WAITER" && r.guestHandle && (
                  <div className="text-xs text-neutral-400 mb-1">od: {r.guestHandle}</div>
                )}
                <div className="text-orange-400 text-sm tracking-wide mb-1">{starsText(r.overallRating)}</div>
                {r.comment && <p className="text-sm text-neutral-600 leading-relaxed">{r.comment}</p>}
                <div className="flex gap-3 mt-2 flex-wrap">
                  {r.ratingAtmosphere    != null && <span className="text-xs text-neutral-400">Atmosfera {starsText(r.ratingAtmosphere)}</span>}
                  {r.ratingOrganization  != null && <span className="text-xs text-neutral-400">Organizacija {starsText(r.ratingOrganization)}</span>}
                  {r.ratingHygieneWork   != null && <span className="text-xs text-neutral-400">Higijena {starsText(r.ratingHygieneWork)}</span>}
                  {r.ratingFriendliness  != null && <span className="text-xs text-neutral-400">Ljubaznost {starsText(r.ratingFriendliness)}</span>}
                  {r.ratingGuestSpeed    != null && <span className="text-xs text-neutral-400">Brzina {starsText(r.ratingGuestSpeed)}</span>}
                  {r.ratingAttentiveness != null && <span className="text-xs text-neutral-400">Pažljivost {starsText(r.ratingAttentiveness)}</span>}
                </div>
                {r.status === "PENDING" && (
                  <div className="flex gap-2 mt-2">
                    <button disabled={moderating === r.id} onClick={() => handleModerate(r.id, "approve")}
                      className="text-xs font-semibold px-3 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 transition-colors">
                      {moderating === r.id ? "..." : "Objavi"}
                    </button>
                    <button disabled={moderating === r.id} onClick={() => handleModerate(r.id, "reject")}
                      className="text-xs font-semibold px-3 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 transition-colors">
                      Odbaci
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Section: Profile ────────────────────────────────────────────────────── */

function VenueCreateForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", address: "", municipality: "", venueType: "RESTAURANT",
    latitude: "", longitude: "", capacity: "", description: "",
    phone: "", website: "", instagram: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        address: form.address,
        municipality: form.municipality,
        venueType: form.venueType,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        capacity: form.capacity ? Number(form.capacity) : undefined,
        description: form.description || undefined,
        phone: form.phone || undefined,
        website: form.website || undefined,
        instagram: form.instagram || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? "Greška pri registraciji lokala.");
      return;
    }
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <h2 className="font-black text-white">Registruj lokal</h2>
      <div className="dash-card p-6 flex flex-col gap-5">
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Naziv lokala *</label>
          <input type="text" required value={form.name}
            onChange={e => set("name", e.target.value)}
            placeholder="npr. Kafana Kod Mene" className="auth-input" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Adresa *</label>
            <input type="text" required value={form.address}
              onChange={e => set("address", e.target.value)}
              placeholder="npr. Skadarska 5" className="auth-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Opština *</label>
            <input type="text" required value={form.municipality}
              onChange={e => set("municipality", e.target.value)}
              placeholder="npr. Stari Grad" className="auth-input" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Tip lokala *</label>
            <select required value={form.venueType}
              onChange={e => set("venueType", e.target.value)} className="auth-input">
              <option value="RESTAURANT">Restoran</option>
              <option value="CAFE">Kafić</option>
              <option value="BAR">Bar</option>
              <option value="CATERING">Ketering</option>
              <option value="HOTEL">Hotel</option>
              <option value="EVENT">Event</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Kapacitet mesta</label>
            <input type="number" min={1} value={form.capacity}
              onChange={e => set("capacity", e.target.value)}
              placeholder="npr. 50" className="auth-input" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1">Koordinate *</label>
          <p className="text-xs text-neutral-400 mb-2">
            Otvorite Google Maps → desni klik na lokaciju → kliknite na koordinate da ih kopirate
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <input type="number" step="any" required value={form.latitude}
              onChange={e => set("latitude", e.target.value)}
              placeholder="Geografska širina (npr. 44.8125)" className="auth-input" />
            <input type="number" step="any" required value={form.longitude}
              onChange={e => set("longitude", e.target.value)}
              placeholder="Geografska dužina (npr. 20.4612)" className="auth-input" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Kratki opis</label>
          <textarea value={form.description}
            onChange={e => set("description", e.target.value)}
            placeholder="Kratki opis vašeg lokala..." rows={3}
            className="auth-input resize-none" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Telefon</label>
            <input type="tel" value={form.phone}
              onChange={e => set("phone", e.target.value)}
              placeholder="+381 11 123 4567" className="auth-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Vebsajt</label>
            <input type="url" value={form.website}
              onChange={e => set("website", e.target.value)}
              placeholder="https://vaslokal.rs" className="auth-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Instagram</label>
            <input type="text" value={form.instagram}
              onChange={e => set("instagram", e.target.value)}
              placeholder="@vaslokal" className="auth-input" />
          </div>
        </div>
      </div>
      {error && (
        <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>
      )}
      <button type="submit" disabled={saving}
        className="btn-dash-orange px-6 py-2.5 self-start disabled:opacity-60">
        {saving ? "Registrovanje..." : "Registruj lokal"}
      </button>
    </form>
  );
}

function ProfileSection({ venue, loading, onVenueCreated, geofenceEnabled, geofenceSaving, onGeofenceToggle }: {
  venue: Venue | null; loading: boolean; onVenueCreated: () => void;
  geofenceEnabled: boolean; geofenceSaving: boolean; onGeofenceToggle: (val: boolean) => void;
}) {
  const [images, setImages] = useState<string[]>([]);
  const [imgSaving, setImgSaving] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ phone: "", website: "", instagram: "", description: "", capacity: "", priceRangeMin: "", priceRangeMax: "" });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => { setImages(venue?.images ?? []); }, [venue?.images]);
  useEffect(() => { setLogo(venue?.logo ?? null); }, [venue?.logo]);
  useEffect(() => {
    if (venue) setEditForm({
      phone: venue.phone ?? "",
      website: venue.website ?? "",
      instagram: venue.instagram ?? "",
      description: venue.description ?? "",
      capacity: venue.capacity?.toString() ?? "",
      priceRangeMin: venue.priceRangeMin?.toString() ?? "",
      priceRangeMax: venue.priceRangeMax?.toString() ?? "",
    });
  }, [venue]);

  async function saveImages(next: string[]) {
    if (!venue) return;
    setImgSaving(true);
    await fetch(`/api/venues/${venue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: next }),
    });
    setImages(next);
    setImgSaving(false);
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !venue) return;
    setLogoUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", "avatar");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) {
      await fetch(`/api/venues/${venue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: data.url }),
      });
      setLogo(data.url);
    }
    setLogoUploading(false);
  }

  if (loading) return <Spinner />;
  if (!venue) return <VenueCreateForm onCreated={onVenueCreated} />;

  const score = Math.round(venue.trustScore) || 0;
  const circumference = 2 * Math.PI * 46;
  const offset = circumference - (score / 100) * circumference;
  const dims = trustDimensions(venue.venueTrustScore);

  const infoFields = [
    { label: "Adresa",          value: venue.address },
    { label: "Opština",         value: venue.municipality },
    { label: "Telefon",         value: venue.phone ?? "—" },
    { label: "Vebsajt",         value: venue.website ?? "—" },
    { label: "Instagram",       value: venue.instagram ?? "—" },
    { label: "Kapacitet",       value: venue.capacity ? `${venue.capacity} mesta` : "—" },
    { label: "Cenovni raspon",  value: venue.priceRangeMin && venue.priceRangeMax
        ? `${venue.priceRangeMin.toLocaleString("sr-RS")} – ${venue.priceRangeMax.toLocaleString("sr-RS")} RSD/h` : "—" },
  ];

  return (
    <>
      <h2 className="font-black text-white">Profil lokala</h2>
      <div className="dash-card p-5">
        <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap sm:gap-6">
          {/* Logo */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={logoUploading}
              className="group disabled:opacity-60"
            >
              <div className="relative w-[72px] h-[72px] rounded-full overflow-hidden border-2 border-dashed border-neutral-300 group-hover:border-orange-400 transition-colors" style={{ isolation: "isolate" }}>
                {logo ? (
                  <Image src={logo} alt="" width={72} height={72} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-orange-100 flex items-center justify-center text-orange-600 font-black text-xl">
                    {getInitials(venue.name)}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{logoUploading ? "..." : "Izmeni"}</span>
                </div>
              </div>
            </button>
            <span className="text-[10px] text-neutral-400">Logo lokala</span>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
          </div>

          {/* Trust score */}
          <div className="relative flex-shrink-0" style={{ width: 96, height: 96 }}>
            <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
              <circle cx="48" cy="48" r="38" fill="none" stroke="#f0efec" strokeWidth="9" />
              <circle cx="48" cy="48" r="38" fill="none" stroke="#f97316" strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 38}
                strokeDashoffset={2 * Math.PI * 38 - (score / 100) * 2 * Math.PI * 38} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-neutral-900">{score || "—"}</span>
              <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wide">trust skor</span>
            </div>
          </div>

          {/* Info */}
          <div className="w-full sm:flex-1 sm:w-auto min-w-0">
            <h3 className="text-xl font-black text-neutral-900">{venue.name}</h3>
            <p className="text-sm text-neutral-500 mt-0.5">{venue.address} · {venue.municipality} · {venue.city}</p>
            <div className="flex gap-2 flex-wrap mt-2">
              <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2.5 py-0.5 rounded-full">{VENUE_TYPE_LABELS[venue.venueType] ?? venue.venueType}</span>
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-0.5 rounded-full">Aktivan</span>
            </div>
          </div>

          {/* Edit button */}
          <button onClick={() => setIsEditing(v => !v)} className="btn-dash-outline px-4 py-2 w-full sm:w-auto flex-shrink-0 sm:self-start">
            {isEditing ? "Zatvori" : "Uredi profil"}
          </button>
        </div>
      </div>
      {isEditing && (
        <div className="dash-card p-5 flex flex-col gap-4">
          <h3 className="font-bold text-neutral-900 text-sm">Uredi kontakt i detalje</h3>
          {[
            { key: "phone",         label: "Telefon",         placeholder: "+381 11 ..." },
            { key: "website",       label: "Vebsajt",         placeholder: "https://..." },
            { key: "instagram",     label: "Instagram",        placeholder: "@naziv" },
            { key: "description",   label: "Opis lokala",      placeholder: "Kratki opis..." },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-semibold text-neutral-600 mb-1 block">{label}</label>
              {key === "description" ? (
                <textarea
                  value={editForm[key as keyof typeof editForm]}
                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  rows={3}
                  className="auth-input resize-none"
                />
              ) : (
                <input
                  value={editForm[key as keyof typeof editForm]}
                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="auth-input"
                />
              )}
            </div>
          ))}
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "capacity",      label: "Kapacitet (mesta)" },
              { key: "priceRangeMin", label: "Min. plata (RSD/h)" },
              { key: "priceRangeMax", label: "Max. plata (RSD/h)" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-neutral-600 mb-1 block">{label}</label>
                <input
                  type="number"
                  min={0}
                  value={editForm[key as keyof typeof editForm]}
                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  className="auth-input"
                />
              </div>
            ))}
          </div>
          <button
            disabled={editSaving}
            onClick={async () => {
              setEditSaving(true);
              await fetch(`/api/venues/${venue.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  phone:        editForm.phone        || null,
                  website:      editForm.website      || null,
                  instagram:    editForm.instagram    || null,
                  description:  editForm.description  || null,
                  capacity:     editForm.capacity     ? Number(editForm.capacity)     : null,
                  priceRangeMin: editForm.priceRangeMin ? Number(editForm.priceRangeMin) : null,
                  priceRangeMax: editForm.priceRangeMax ? Number(editForm.priceRangeMax) : null,
                }),
              });
              setEditSaving(false);
              setIsEditing(false);
            }}
            className="btn-dash-orange py-2.5 disabled:opacity-50 self-start px-8"
          >
            {editSaving ? "Čuvanje..." : "Sačuvaj"}
          </button>
        </div>
      )}

      <div className="dash-card p-5 grid gap-4 sm:grid-cols-2">
        {infoFields.map(({ label, value }) => (
          <div key={label}>
            <div className="text-xs text-neutral-400 font-medium mb-0.5">{label}</div>
            <div className="text-sm font-semibold text-neutral-900">{value}</div>
          </div>
        ))}
      </div>

      {/* Settings */}
      <div className="dash-card p-5 flex flex-col gap-3">
        <h3 className="font-bold text-neutral-900 text-sm">Podešavanja lokala</h3>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-neutral-800">GPS geofencing za recenzije</div>
            <div className="text-xs text-neutral-400 mt-0.5">Gosti moraju biti fizički u lokalu da bi ostavili recenziju. Konobarima je potrebna lokacija za čekiranje smene.</div>
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
      </div>

      {/* Photos */}
      <div className="dash-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-neutral-900 text-sm">Fotografije lokala</h3>
          <span className="text-xs text-neutral-400">{images.length}/8</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((src, i) => (
            <div key={src} className="relative group rounded-xl overflow-hidden aspect-video bg-neutral-100">
              <Image src={src} alt="" fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover" />
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  Naslovna
                </span>
              )}
              <button
                onClick={() => saveImages(images.filter((_, j) => j !== i))}
                disabled={imgSaving}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-40"
              >
                ×
              </button>
            </div>
          ))}

          {images.length < 8 && (
            <div className="aspect-video">
              <ImageUpload
                uploadType="venue-photo"
                className="h-full"
                onUpload={async (url) => saveImages([...images, url])}
              />
            </div>
          )}
        </div>

        <p className="text-xs text-neutral-400">
          Prva slika je naslovna fotografija prikazana u pretrazi. Maks. 8 slika.
        </p>
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
        {!venue.venueTrustScore && <p className="text-xs text-neutral-400 mt-3 text-center">Trust Score se računa nakon prvih recenzija</p>}
      </div>
    </>
  );
}

/* ── Shift modal ─────────────────────────────────────────────────────────── */

function ShiftModal({ shift, date, venue, waiters, onSave, onDelete, onClose }: {
  shift: VenueShift | null;
  date: Date | null;
  venue: Venue;
  waiters: { id: string; name: string | null }[];
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const toInput = (d: Date) => d.toLocaleDateString("sv-SE");
  const [form, setForm] = useState({
    title:         shift?.title          ?? "",
    date:          shift ? shift.date.slice(0, 10) : (date ? toInput(date) : ""),
    startTime:     shift?.startTime      ?? "18:00",
    endTime:       shift?.endTime        ?? "02:00",
    role:          shift?.role           ?? "",
    requiredCount: shift?.requiredCount?.toString() ?? "1",
    tipEstimate:   shift?.tipEstimate?.toString()   ?? "",
    pay:           shift?.pay?.toString()            ?? "",
    briefingNote:  shift?.briefingNote   ?? "",
    notes:         shift?.notes          ?? "",
    swapLocked:    shift?.swapLocked     ?? false,
    waiterIds:     shift?.assignments.map(a => a.waiterId) ?? [] as string[],
  });
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError]           = useState("");

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  const toggleWaiter = (id: string) =>
    setForm(p => ({
      ...p,
      waiterIds: p.waiterIds.includes(id)
        ? p.waiterIds.filter(w => w !== id)
        : [...p.waiterIds, id],
    }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const url    = shift ? `/api/shifts/${shift.id}` : "/api/shifts";
    const method = shift ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venueId:      venue.id,
        title:        form.title,
        date:         form.date,
        startTime:    form.startTime,
        endTime:      form.endTime,
        role:         form.role         || undefined,
        requiredCount: Number(form.requiredCount) || 1,
        tipEstimate:  form.tipEstimate  ? Number(form.tipEstimate) : undefined,
        pay:          form.pay          ? Number(form.pay) : undefined,
        briefingNote: form.briefingNote || undefined,
        notes:        form.notes        || undefined,
        swapLocked:   form.swapLocked,
        waiterIds:    form.waiterIds,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? "Greška.");
      return;
    }
    onSave();
  }

  async function handleDelete() {
    if (!shift) return;
    setDeleting(true);
    await fetch(`/api/shifts/${shift.id}`, { method: "DELETE" });
    setDeleting(false);
    onDelete();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dash-card w-full max-w-md p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-neutral-900">{shift ? "Uredi smenu" : "Nova smena"}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-600 text-lg">✕</button>
        </div>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Naziv smene *</label>
            <input type="text" required value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="npr. Večernja smena" className="auth-input" />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Datum *</label>
            <input type="date" required value={form.date} onChange={e => set("date", e.target.value)}
              className="auth-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Od *</label>
              <input type="time" required value={form.startTime} onChange={e => set("startTime", e.target.value)}
                className="auth-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Do *</label>
              <input type="time" required value={form.endTime} onChange={e => set("endTime", e.target.value)}
                className="auth-input" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Uloga</label>
              <input type="text" value={form.role} onChange={e => set("role", e.target.value)}
                placeholder="Konobar" className="auth-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Broj ljudi</label>
              <input type="number" min={1} max={20} value={form.requiredCount} onChange={e => set("requiredCount", e.target.value)}
                className="auth-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Naknada (RSD)</label>
              <input type="number" min={0} value={form.pay} onChange={e => set("pay", e.target.value)}
                placeholder="3 000" className="auth-input" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Očekivani bakšiš (RSD) — prikazuje se u tržištu</label>
            <input type="number" min={0} value={form.tipEstimate} onChange={e => set("tipEstimate", e.target.value)}
              placeholder="npr. 2 000" className="auth-input" />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Briefing za smenu</label>
            <textarea value={form.briefingNote} onChange={e => set("briefingNote", e.target.value)}
              rows={2} placeholder="Vidljivo samo konobaru 2h pre smene..." className="auth-input resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Konobari</label>
            {waiters.length === 0 ? (
              <p className="text-[11px] text-neutral-400">Nema prihvaćenih konobara za ovaj lokal.</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto border border-neutral-200 rounded-xl p-2">
                {waiters.map(w => (
                  <label key={w.id} className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={form.waiterIds.includes(w.id)} onChange={() => toggleWaiter(w.id)}
                      className="w-4 h-4 rounded accent-orange-500 flex-shrink-0" />
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-[9px] flex-shrink-0">
                      {getInitials(w.name)}
                    </div>
                    <span className="text-sm text-neutral-700">{w.name ?? w.id.slice(0, 8)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Interna napomena</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
              rows={2} className="auth-input resize-none" />
          </div>
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-sm font-semibold text-neutral-700">Blokiraj zamene</div>
              <div className="text-[11px] text-neutral-400">Konobari ne mogu menjati ovu smenu</div>
            </div>
            <button type="button" onClick={() => set("swapLocked", !form.swapLocked)}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${form.swapLocked ? "bg-orange-500" : "bg-neutral-200"}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.swapLocked ? "translate-x-5" : ""}`} />
            </button>
          </div>
          {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="btn-dash-orange flex-1 py-2.5 disabled:opacity-60">
              {saving ? "Čuvanje..." : (shift ? "Sačuvaj" : "Dodaj smenu")}
            </button>
            {shift && !confirmDel && (
              <button type="button" onClick={() => setConfirmDel(true)}
                className="btn-dash-outline px-4 py-2.5 text-red-400 hover:border-red-300 hover:text-red-500">
                Obriši
              </button>
            )}
            {shift && confirmDel && (
              <button type="button" disabled={deleting} onClick={handleDelete}
                className="btn-dash-outline px-4 py-2.5 border-red-300 text-red-500 hover:bg-red-50 disabled:opacity-60">
                {deleting ? "..." : "Potvrdi?"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Template modal ──────────────────────────────────────────────────────── */

const DAYS_FULL_SR = ["Nedjelja", "Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"];

function TemplateModal({ template, venueId, onSave, onClose }: {
  template: ShiftTemplate | null;
  venueId: string;
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name:          template?.name              ?? "",
    weekdaysOnly:  template?.weekdaysOnly      ?? false,
    dayOfWeek:     template?.dayOfWeek?.toString() ?? "5",
    startTime:     template?.startTime         ?? "18:00",
    endTime:       template?.endTime           ?? "02:00",
    requiredCount: template?.requiredCount?.toString() ?? "2",
    role:          template?.role              ?? "",
    pay:           template?.pay?.toString()   ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const url    = template ? `/api/shifts/templates/${template.id}` : "/api/shifts/templates";
    const method = template ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venueId,
        name:          form.name,
        weekdaysOnly:  form.weekdaysOnly,
        dayOfWeek:     form.weekdaysOnly ? null : Number(form.dayOfWeek),
        startTime:     form.startTime,
        endTime:       form.endTime,
        requiredCount: Number(form.requiredCount) || 1,
        role:          form.role  || undefined,
        pay:           form.pay   ? Number(form.pay) : undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? "Greška.");
      return;
    }
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dash-card w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-neutral-900">{template ? "Uredi šablon" : "Novi šablon"}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-600 text-lg">✕</button>
        </div>
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Naziv šablona *</label>
            <input type="text" required value={form.name} onChange={e => set("name", e.target.value)}
              placeholder="npr. Petkom naveče" className="auth-input" />
          </div>
          {/* Day picker */}
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Dani</label>
            <button type="button"
              onClick={() => set("weekdaysOnly", !form.weekdaysOnly)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${form.weekdaysOnly ? "border-orange-400 bg-orange-50 text-orange-700" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"}`}>
              {form.weekdaysOnly ? "Radni dani (Pon–Pet)" : "Jedan dan u nedelji →"}
            </button>
            {!form.weekdaysOnly && (
              <select value={form.dayOfWeek} onChange={e => set("dayOfWeek", e.target.value)} className="auth-input mt-2">
                {DAYS_FULL_SR.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Od *</label>
              <input type="time" required value={form.startTime} onChange={e => set("startTime", e.target.value)} className="auth-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Do *</label>
              <input type="time" required value={form.endTime} onChange={e => set("endTime", e.target.value)} className="auth-input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Broj ljudi</label>
              <input type="number" min={1} max={20} value={form.requiredCount} onChange={e => set("requiredCount", e.target.value)} className="auth-input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Naknada (RSD)</label>
              <input type="number" min={0} value={form.pay} onChange={e => set("pay", e.target.value)} placeholder="Po dogovoru" className="auth-input" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Uloga</label>
            <input type="text" value={form.role} onChange={e => set("role", e.target.value)} placeholder="npr. Konobar" className="auth-input" />
          </div>
          {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}
          <button type="submit" disabled={saving} className="btn-dash-orange py-2.5 disabled:opacity-60">
            {saving ? "Čuvanje..." : (template ? "Sačuvaj" : "Dodaj šablon")}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Generate modal ──────────────────────────────────────────────────────── */

function GenerateModal({ template, onDone, onClose }: {
  template: ShiftTemplate;
  onDone: (created: number, skipped: number) => void;
  onClose: () => void;
}) {
  const today    = new Date().toISOString().slice(0, 10);
  const fourWeeks = new Date(Date.now() + 28 * 86_400_000).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate]     = useState(fourWeeks);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError]       = useState("");

  async function handleGenerate() {
    setError("");
    setLoading(true);
    const res = await fetch(`/api/shifts/templates/${template.id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromDate, toDate }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? "Greška.");
      return;
    }
    const data = await res.json();
    setResult(data);
    onDone(data.created, data.skipped);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dash-card w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-neutral-900">Generiši smene</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-600 text-lg">✕</button>
        </div>
        <div className="bg-neutral-50 rounded-xl p-3">
          <div className="font-semibold text-neutral-800 text-sm">{template.name}</div>
          <div className="text-xs text-neutral-400 mt-0.5">
            {template.weekdaysOnly ? "Radni dani (Pon–Pet)" : DAYS_FULL_SR[template.dayOfWeek ?? 0]} · {template.startTime}–{template.endTime} · {template.requiredCount} {template.requiredCount === 1 ? "osoba" : "osobe"}
          </div>
        </div>
        {result ? (
          <div className="text-center py-4">
            <div className="text-2xl font-black text-green-600">{result.created}</div>
            <div className="text-sm text-neutral-500">smena kreirano</div>
            {result.skipped > 0 && <div className="text-xs text-neutral-400 mt-1">{result.skipped} preskočeno (već postoje)</div>}
            <button onClick={onClose} className="btn-dash-orange px-6 py-2 mt-4">Zatvori</button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Od datuma</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="auth-input" />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-600 mb-1.5 block">Do datuma</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="auth-input" />
              </div>
            </div>
            {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}
            <button onClick={handleGenerate} disabled={loading} className="btn-dash-orange py-2.5 disabled:opacity-60">
              {loading ? "Generišem..." : "Generiši smene"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Shift template tab ──────────────────────────────────────────────────── */

// Parse "HH:MM" → minutes, treating midnight-crossing (end < start) by adding 1440 to end
function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function shiftsOverlap(a: ShiftTemplate, b: ShiftTemplate) {
  const aS = toMins(a.startTime); let aE = toMins(a.endTime);
  const bS = toMins(b.startTime); let bE = toMins(b.endTime);
  if (aE <= aS) aE += 1440; // overnight
  if (bE <= bS) bE += 1440;
  // both weekdaysOnly or share a day → could be scheduled same day
  const sameDay = a.weekdaysOnly || b.weekdaysOnly || a.dayOfWeek === b.dayOfWeek;
  return sameDay && aS < bE && bS < aE;
}

const QUICK_APPLY_PRESETS: Array<{
  name: string; startTime: string; endTime: string;
  meta: TemplateMeta; label: string; sublabel: string;
}> = [
  { name: "Jutarnja Standard", startTime: "08:00", endTime: "16:00",
    meta: { type: "morning", label: "Jutarnja Standard", shift: "1" },
    label: "Smena 1", sublabel: "08:00 – 16:00 · Radni dani" },
  { name: "Jutarnja Kasna", startTime: "09:00", endTime: "17:00",
    meta: { type: "morning", label: "Jutarnja Kasna", shift: "1" },
    label: "Smena 1", sublabel: "09:00 – 17:00 · Radni dani" },
  { name: "Popodnevna Standard", startTime: "16:00", endTime: "23:30",
    meta: { type: "evening", label: "Popodnevna Standard", shift: "2" },
    label: "Smena 2", sublabel: "16:00 – 23:30 · Radni dani" },
  { name: "Popodnevna Kasna", startTime: "17:00", endTime: "00:00",
    meta: { type: "evening", label: "Popodnevna Kasna", shift: "2" },
    label: "Smena 2", sublabel: "17:00 – 00:00 · Radni dani" },
];

function ShiftTemplateTab({ venue, onShiftsChanged }: { venue: Venue; onShiftsChanged: () => void }) {
  const [templates, setTemplates]   = useState<ShiftTemplate[]>([]);
  const [loading, setLoading]       = useState(true);
  const [creating, setCreating]     = useState(false);
  const [editing, setEditing]       = useState<ShiftTemplate | null>(null);
  const [generating, setGenerating] = useState<ShiftTemplate | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [applying, setApplying]     = useState<string | null>(null);

  const fetchTemplates = () => {
    setLoading(true);
    fetch("/api/shifts/templates")
      .then(r => r.ok ? r.json() : [])
      .then(setTemplates)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTemplates(); }, []);

  async function handleDelete(id: string) {
    setDeleting(id);
    await fetch(`/api/shifts/templates/${id}`, { method: "DELETE" });
    setDeleting(null);
    fetchTemplates();
  }

  async function applyPreset(preset: typeof QUICK_APPLY_PRESETS[0]) {
    setApplying(preset.name);
    await fetch("/api/shifts/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venueId:      venue.id,
        name:         preset.name,
        weekdaysOnly: true,
        dayOfWeek:    null,
        metadata:     preset.meta,
        startTime:    preset.startTime,
        endTime:      preset.endTime,
        requiredCount: 2,
      }),
    });
    setApplying(null);
    fetchTemplates();
  }

  // Overlap detection across all template pairs
  const overlapPairs: [string, string][] = [];
  for (let i = 0; i < templates.length; i++) {
    for (let j = i + 1; j < templates.length; j++) {
      if (shiftsOverlap(templates[i], templates[j])) {
        overlapPairs.push([templates[i].name, templates[j].name]);
      }
    }
  }

  // Group by metadata.shift; ungrouped in "Ostalo"
  const group1  = templates.filter(t => t.metadata?.shift === "1");
  const group2  = templates.filter(t => t.metadata?.shift === "2");
  const groupOther = templates.filter(t => !t.metadata?.shift);

  function TemplateCard({ t }: { t: ShiftTemplate }) {
    const dayLabel = t.weekdaysOnly ? "Radni dani" : (DAYS_FULL_SR[t.dayOfWeek ?? 0] ?? "");
    return (
      <div className="dash-card p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <div className="font-bold text-neutral-900">{t.name}</div>
              {t.metadata?.shift && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${t.metadata.type === "morning" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"}`}>
                  Smena {t.metadata.shift}
                </span>
              )}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">{dayLabel} · {t.startTime}–{t.endTime}</div>
            <div className="flex gap-3 mt-1.5 text-xs text-neutral-400">
              <span>{t.requiredCount} {t.requiredCount === 1 ? "osoba" : "osobe"}</span>
              {t.role && <span>· {t.role}</span>}
              {t.pay != null && <span>· {t.pay.toLocaleString("sr-RS")} RSD</span>}
            </div>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <button onClick={() => setEditing(t)}
              className="text-xs text-neutral-400 hover:text-neutral-700 px-2 py-1 rounded-lg hover:bg-neutral-100 transition-colors">
              Uredi
            </button>
            <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id}
              className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
              {deleting === t.id ? "..." : "Briši"}
            </button>
          </div>
        </div>
        <button onClick={() => setGenerating(t)} className="btn-dash-orange py-2 text-sm w-full">
          Generiši smene
        </button>
      </div>
    );
  }

  function GroupSection({ title, items, color }: { title: string; items: ShiftTemplate[]; color: string }) {
    if (items.length === 0) return null;
    return (
      <div>
        <div className={`text-xs font-black uppercase tracking-wider mb-2 ${color}`}>{title}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map(t => <TemplateCard key={t.id} t={t} />)}
        </div>
      </div>
    );
  }

  if (loading) return <Spinner />;

  // Which presets already exist (match by name)
  const existingNames = new Set(templates.map(t => t.name));

  return (
    <>
      {(creating || editing) && (
        <TemplateModal
          template={editing}
          venueId={venue.id}
          onSave={() => { setCreating(false); setEditing(null); fetchTemplates(); }}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
      {generating && (
        <GenerateModal
          template={generating}
          onDone={() => { onShiftsChanged(); }}
          onClose={() => setGenerating(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-white">Šabloni smena</h3>
          <p className="text-xs text-white/40 mt-0.5">Sačuvani obrasci za ponavljajuće smene. Kliknite &quot;Generiši&quot; za bulk kreiranje.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-dash-orange px-4 py-2">+ Novi šablon</button>
      </div>

      {/* Quick-Apply preset cards */}
      <div className="dash-card p-4">
        <div className="text-xs font-black text-neutral-400 uppercase tracking-wider mb-3">Brzo dodaj predefinisanu smenu</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUICK_APPLY_PRESETS.map(p => {
            const exists = existingNames.has(p.name);
            return (
              <button
                key={p.name}
                onClick={() => !exists && applyPreset(p)}
                disabled={exists || applying === p.name}
                className={[
                  "relative flex flex-col items-start p-3 rounded-xl border text-left transition-all",
                  exists
                    ? "border-green-200 bg-green-50 cursor-default"
                    : "border-neutral-200 bg-white hover:border-orange-300 hover:bg-orange-50/40 cursor-pointer",
                  applying === p.name ? "opacity-60" : "",
                ].join(" ")}>
                <span className={`text-[10px] font-black uppercase tracking-wider mb-1 ${p.meta.type === "morning" ? "text-amber-500" : "text-indigo-500"}`}>
                  {p.label}
                </span>
                <span className="text-xs font-bold text-neutral-800 leading-tight">{p.name}</span>
                <span className="text-[11px] text-neutral-400 mt-0.5">{p.sublabel}</span>
                {exists && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                    <svg width="8" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                )}
                {applying === p.name && <span className="text-[10px] text-orange-500 mt-1">Dodajem...</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Overlap warning */}
      {overlapPairs.length > 0 && (
        <div className="rounded-xl border border-amber-200 px-4 py-3 flex items-start gap-3"
          style={{ background: "rgba(251,191,36,0.08)", backdropFilter: "blur(8px)" }}>
          <svg className="flex-shrink-0 mt-0.5 text-amber-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <div className="text-xs font-bold text-amber-700">Vremensko preklapanje smena</div>
            <div className="text-xs text-amber-600 mt-0.5">
              {overlapPairs.map(([a, b]) => `"${a}" i "${b}"`).join(" · ")} — isti konobar ne može biti u obe smene.
            </div>
          </div>
        </div>
      )}

      {/* Template list grouped by shift */}
      {templates.length === 0 ? (
        <div className="dash-card p-10 text-center text-neutral-400 text-sm">
          Nema šablona — koristite brzo dodavanje iznad ili &quot;+ Novi šablon&quot;
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <GroupSection title="Smena 1 — Jutarnja" items={group1} color="text-amber-600" />
          <GroupSection title="Smena 2 — Popodnevna" items={group2} color="text-indigo-600" />
          <GroupSection title="Ostalo" items={groupOther} color="text-neutral-500" />
        </div>
      )}
    </>
  );
}

/* ── Staffing bar ────────────────────────────────────────────────────────── */

function StaffingBar({ filled, required }: { filled: number; required: number }) {
  const pct  = required > 0 ? Math.min(filled / required, 1) : 0;
  const cls  = pct === 0 ? "bg-red-400" : pct < 1 ? "bg-amber-400" : "bg-green-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-neutral-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${cls}`} style={{ width: `${pct * 100}%` }} />
      </div>
      <span className={`text-[9px] font-bold ${pct === 0 ? "text-red-500" : pct < 1 ? "text-amber-600" : "text-green-700"}`}>
        {filled}/{required}
      </span>
    </div>
  );
}

/* ── Head Waiter Panel ───────────────────────────────────────────────────── */

function HeadWaiterPanel({ venue, waiters, onRefresh }: {
  venue: Venue;
  waiters: { id: string; name: string | null }[];
  onRefresh: () => void;
}) {
  const [busy, setBusy]           = useState(false);
  const [selectId, setSelectId]   = useState("");

  async function appoint() {
    if (!selectId) return;
    setBusy(true);
    await fetch(`/api/venues/${venue.id}/head-waiter`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waiterId: selectId }),
    });
    setBusy(false);
    setSelectId("");
    onRefresh();
  }

  async function remove() {
    setBusy(true);
    await fetch(`/api/venues/${venue.id}/head-waiter`, { method: "DELETE" });
    setBusy(false);
    onRefresh();
  }

  return (
    <div className="dash-card p-4 flex items-center gap-4 flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-neutral-500 mb-0.5">Šef konobara</div>
        {venue.headWaiter ? (
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 text-xs font-black flex items-center justify-center">
              {(venue.headWaiter.name ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <span className="text-sm font-bold text-neutral-900">{venue.headWaiter.name ?? "—"}</span>
            <span className="text-[10px] bg-orange-50 text-orange-600 font-semibold px-2 py-0.5 rounded-full">Aktivan</span>
          </div>
        ) : (
          <div className="text-sm text-neutral-400">Nije postavljen</div>
        )}
      </div>

      {venue.headWaiter ? (
        <button
          onClick={remove}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50">
          Ukloni
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={selectId}
            onChange={e => setSelectId(e.target.value)}
            className="auth-input py-1.5 text-xs w-44">
            <option value="">Izaberi konobara…</option>
            {waiters.map(w => (
              <option key={w.id} value={w.id}>{w.name ?? w.id}</option>
            ))}
          </select>
          <button
            onClick={appoint}
            disabled={!selectId || busy}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-40">
            Postavi
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Pending clock-in approval row ───────────────────────────────────────── */

function PendingClockInRow({ assignment, onDone }: {
  assignment: VenueShiftAssignment;
  onDone: () => void;
}) {
  const [acting, setActing] = useState<"approve" | "reject" | null>(null);

  async function handle(action: "approve" | "reject") {
    setActing(action);
    await fetch(`/api/shifts/assignments/${assignment.id}/approve-clockin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActing(null);
    onDone();
  }

  return (
    <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
      <span className="text-[10px] font-semibold text-amber-800 truncate">
        {assignment.waiter.name ?? "Konobar"} — čeka prijavu
      </span>
      <div className="flex gap-1.5 flex-shrink-0">
        <button
          onClick={() => handle("approve")}
          disabled={acting !== null}
          className="text-[10px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full hover:bg-green-600 disabled:opacity-50 transition-colors">
          {acting === "approve" ? "..." : "Odobri"}
        </button>
        <button
          onClick={() => handle("reject")}
          disabled={acting !== null}
          className="text-[10px] font-bold bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full hover:bg-neutral-300 disabled:opacity-50 transition-colors">
          {acting === "reject" ? "..." : "Odbij"}
        </button>
      </div>
    </div>
  );
}

/* ── Section: Smene (venue) ──────────────────────────────────────────────── */

function VenueSmeneSection({ venue, shifts, loading, acceptedWaiters, onRefresh }: {
  venue: Venue | null;
  shifts: VenueShift[];
  loading: boolean;
  acceptedWaiters: { id: string; name: string | null }[];
  onRefresh: () => void;
}) {
  const now = new Date();
  const [mainTab, setMainTab]   = useState<"kalendar" | "sabloni">("kalendar");
  const [current, setCurrent]   = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [creating, setCreating] = useState<Date | null>(null);
  const [editing, setEditing]   = useState<VenueShift | null>(null);
  const [swapActing, setSwapActing] = useState<string | null>(null);

  if (loading) return <Spinner />;
  if (!venue)  return <EmptyVenue onNavigate={() => {}} />;

  const year  = current.getFullYear();
  const month = current.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalCells  = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const todayNum    = now.getFullYear() === year && now.getMonth() === month ? now.getDate() : -1;

  const shiftsByDay: Record<number, VenueShift[]> = {};
  for (const s of shifts) {
    const d = new Date(s.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!shiftsByDay[day]) shiftsByDay[day] = [];
      shiftsByDay[day].push(s);
    }
  }

  const upcoming = shifts
    .filter(s => new Date(s.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 8);

  const pendingSwaps = shifts.flatMap(s => s.swapRequests ?? []);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  async function handleSwapAction(swapId: string, action: "ACCEPTED" | "REJECTED") {
    setSwapActing(swapId);
    await fetch(`/api/shifts/swaps/${swapId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setSwapActing(null);
    onRefresh();
  }

  return (
    <>
      {(creating || editing) && (
        <ShiftModal
          shift={editing}
          date={creating}
          venue={venue}
          waiters={acceptedWaiters}
          onSave={() => { setCreating(null); setEditing(null); onRefresh(); }}
          onDelete={() => { setEditing(null); onRefresh(); }}
          onClose={() => { setCreating(null); setEditing(null); }}
        />
      )}

      <HeadWaiterPanel venue={venue} waiters={acceptedWaiters} onRefresh={onRefresh} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.07)" }}>
          <button
            onClick={() => setMainTab("kalendar")}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${mainTab === "kalendar" ? "bg-white/15 text-white shadow-sm" : "text-white/50 hover:text-white/80"}`}>
            Kalendar
          </button>
          <button
            onClick={() => setMainTab("sabloni")}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${mainTab === "sabloni" ? "bg-white/15 text-white shadow-sm" : "text-white/50 hover:text-white/80"}`}>
            Šabloni
          </button>
        </div>
        {mainTab === "kalendar" && (
          <button onClick={() => setCreating(now)} className="btn-dash-orange px-4 py-2">+ Nova smena</button>
        )}
      </div>

      {mainTab === "sabloni" && <ShiftTemplateTab venue={venue} onShiftsChanged={onRefresh} />}

      {mainTab === "kalendar" && <>

      {/* Pending swap approvals */}
      {pendingSwaps.length > 0 && (
        <div className="dash-card p-4">
          <h3 className="text-xs font-black text-amber-600 uppercase tracking-wider mb-3">Zahtevi za zamenu ({pendingSwaps.length})</h3>
          <div className="flex flex-col gap-2">
            {pendingSwaps.map(sw => {
              const parentShift = shifts.find(s => s.swapRequests?.some(r => r.id === sw.id));
              const dateStr = parentShift
                ? new Date(parentShift.date).toLocaleDateString("sr-Latn-RS", { weekday: "short", day: "numeric", month: "short" })
                : "";
              return (
                <div key={sw.id} className="flex items-center gap-3 py-2 border-b border-neutral-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-neutral-800">
                      {sw.fromAssignment.waiter.name ?? "Konobar"}
                    </span>
                    <span className="text-xs text-neutral-400 ml-1.5">→ {sw.toWaiter.name ?? "Konobar"}</span>
                    {dateStr && <div className="text-xs text-neutral-400 mt-0.5">{parentShift?.title} · {dateStr}</div>}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => handleSwapAction(sw.id, "ACCEPTED")} disabled={swapActing === sw.id}
                      className="text-xs font-bold bg-green-500 text-white hover:bg-green-600 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50">
                      {swapActing === sw.id ? "..." : "Odobri"}
                    </button>
                    <button onClick={() => handleSwapAction(sw.id, "REJECTED")} disabled={swapActing === sw.id}
                      className="text-xs font-bold bg-neutral-100 text-neutral-500 hover:bg-neutral-200 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50">
                      Odbij
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendar card */}
      <div className="dash-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <button onClick={() => setCurrent(new Date(year, month - 1, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div className="flex items-center gap-3">
            <span className="font-bold text-neutral-900">{MONTHS_SR[month]} {year}</span>
            {!isCurrentMonth && (
              <button onClick={() => setCurrent(new Date(now.getFullYear(), now.getMonth(), 1))}
                className="text-xs text-orange-500 font-semibold hover:underline">Danas</button>
            )}
          </div>
          <button onClick={() => setCurrent(new Date(year, month + 1, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-neutral-100">
          {DAYS_SR.map(d => (
            <div key={d} className="text-center text-[11px] font-bold text-neutral-400 py-2.5">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: totalCells }, (_, i) => {
            const dayNum      = i - firstDay + 1;
            const isValid     = dayNum >= 1 && dayNum <= daysInMonth;
            const isToday     = dayNum === todayNum;
            const isLastInRow = (i + 1) % 7 === 0;
            const isLastRow   = i >= totalCells - 7;
            const dayShifts   = isValid ? (shiftsByDay[dayNum] ?? []) : [];
            return (
              <div key={i}
                onClick={() => { if (isValid) setCreating(new Date(year, month, dayNum)); }}
                className={[
                  "min-h-[84px] p-1.5",
                  !isLastInRow && "border-r border-neutral-100",
                  !isLastRow   && "border-b border-neutral-100",
                  isValid ? "cursor-pointer hover:bg-orange-50/60 transition-colors" : "bg-neutral-50/40",
                ].filter(Boolean).join(" ")}>
                {isValid && (
                  <>
                    <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-orange-500 text-white" : "text-neutral-500"}`}>
                      {dayNum}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {dayShifts.slice(0, 2).map((s, idx) => {
                        const filled  = s.assignments.length;
                        const clocked = s.assignments.filter(a => a.clockInAt).length;
                        const hasSwap = (s.swapRequests?.length ?? 0) > 0;
                        const isOpen  = s.status === "OPEN";
                        return (
                          <div key={s.id}>
                            {idx > 0 && <div className="h-px bg-neutral-300/60 my-0.5 mx-0.5" />}
                            <div
                              onClick={e => { e.stopPropagation(); setEditing(s); }}
                              title="Kliknite za uređivanje"
                              className={`text-[10px] font-semibold px-1 py-0.5 rounded cursor-pointer hover:opacity-75 transition-opacity min-w-0 ${isOpen ? "bg-orange-100 text-orange-600" : hasSwap ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                              <div className="flex items-center gap-0.5 min-w-0">
                                {clocked > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
                                {hasSwap && <span className="text-[8px] flex-shrink-0">🔄</span>}
                                <span className="truncate">{s.startTime}</span>
                              </div>
                              <StaffingBar filled={filled} required={s.requiredCount} />
                              {s.assignments.length > 0 && (
                                <div className="flex gap-0.5 mt-0.5 flex-wrap">
                                  {s.assignments.slice(0, 3).map(a => (
                                    <span key={a.id} title={a.waiter.name ?? "Konobar"}
                                      className="w-3 h-3 rounded-full bg-white/70 text-orange-700 flex items-center justify-center text-[7px] font-black flex-shrink-0 border border-orange-200">
                                      {getInitials(a.waiter.name).slice(0, 1)}
                                    </span>
                                  ))}
                                  {s.assignments.length > 3 && (
                                    <span className="text-[7px] text-neutral-400 leading-3 self-center">+{s.assignments.length - 3}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {dayShifts.length > 2 && (
                        <div className="text-[10px] text-neutral-400 font-medium px-1">+{dayShifts.length - 2}</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-white/45">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-200 inline-block" />Slobodna smena</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block" />Popunjena</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200 inline-block" />Zamena na čekanju 🔄</span>
        <span className="text-white/30">Kliknite na dan za novu smenu · na smenu za uređivanje</span>
      </div>

      {/* Upcoming list with staffing + clock-in status */}
      {upcoming.length > 0 && (
        <div className="dash-card p-5">
          <h3 className="font-bold text-neutral-900 text-sm mb-3">Nadolazeće smene</h3>
          <div className="flex flex-col gap-0">
            {upcoming.map(s => {
              const dateStr  = new Date(s.date).toLocaleDateString("sr-Latn-RS", { weekday: "short", day: "numeric", month: "short" });
              const filled   = s.assignments.length;
              const clocked  = s.assignments.filter(a => a.clockInAt && !a.clockOutAt).length;
              return (
                <div key={s.id} onClick={() => setEditing(s)}
                  className="py-2.5 border-b border-neutral-100 last:border-0 cursor-pointer hover:opacity-75 transition-opacity">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
                        {clocked > 0 && <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />}
                        {s.title}
                        {s.role && <span className="ml-1 text-[11px] text-neutral-400 font-normal">· {s.role}</span>}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5 capitalize">{dateStr} · {s.startTime}–{s.endTime}</div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4 min-w-[100px]">
                      <StaffingBar filled={filled} required={s.requiredCount} />
                      {filled > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap justify-end">
                          {s.assignments.map(a => (
                            <span key={a.id} title={a.waiter.name ?? "Konobar"}
                              className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                              {getInitials(a.waiter.name)}
                            </span>
                          ))}
                        </div>
                      )}
                      {s.pay != null && <div className="text-xs font-black text-orange-500 mt-0.5">{s.pay.toLocaleString("sr-RS")} RSD</div>}
                    </div>
                  </div>
                  {clocked > 0 && (
                    <div className="mt-1 flex gap-1.5 flex-wrap">
                      {s.assignments.filter(a => a.clockInAt && !a.clockOutAt).map(a => (
                        <span key={a.id} className="text-[10px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          {a.waiter.name ?? "Konobar"}
                        </span>
                      ))}
                    </div>
                  )}
                  {s.assignments.some(a => a.pendingClockIn) && (
                    <div className="mt-1.5 flex flex-col gap-1">
                      {s.assignments.filter(a => a.pendingClockIn).map(a => (
                        <PendingClockInRow key={a.id} assignment={a} onDone={onRefresh} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {shifts.length === 0 && (
        <div className="dash-card p-10 text-center text-neutral-400 text-sm">
          Nema smena — kliknite na dan u kalendaru ili koristite &quot;+ Nova smena&quot;
        </div>
      )}

      </>}
    </>
  );
}

/* ── Nav ─────────────────────────────────────────────────────────────────── */

const NAV_ITEMS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: "overview",     label: "Pregled",       icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg> },
  { key: "posts",        label: "Oglasi",        icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg> },
  { key: "smene",        label: "Smene",         icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
  { key: "applications", label: "Prijave",       icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" /></svg> },
  { key: "waiters",      label: "Konobari",      icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
  { key: "discover",     label: "Pronađi",       icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> },
  { key: "reviews",      label: "Recenzije",     icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg> },
  { key: "qr-review",   label: "QR Recenzije",  icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M17 17h4"/><path d="M17 21v-4"/><path d="M21 14v3"/></svg> },
  { key: "profile",       label: "Profil lokala",  icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
  { key: "notifications", label: "Obaveštenja",    icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
];

const SECTION_TITLES: Record<Section, string> = {
  overview: "Pregled", posts: "Oglasi", "new-post": "Novi oglas", smene: "Smene",
  applications: "Prijave", waiters: "Konobari", discover: "Pronađi konobara",
  reviews: "Recenzije", "qr-review": "QR Recenzije", profile: "Profil lokala",
  notifications: "Obaveštenja",
};

/* ── Main dashboard ──────────────────────────────────────────────────────── */

export default function VenueDashboard() {
  const { data: session } = useSession();
  const [section, setSection]           = useState<Section>("overview");
  const [venue, setVenue]               = useState<Venue | null>(null);
  const [posts, setPosts]               = useState<OwnPost[]>([]);
  const [applications, setApplications] = useState<IncomingApp[]>([]);
  const [shifts, setShifts]             = useState<VenueShift[]>([]);
  const [loading, setLoading]           = useState(true);
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [inviteTarget, setInviteTarget] = useState<WaiterEntry | null>(null);
  const [notifUnread, setNotifUnread]   = useState(0);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
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
      setMobileOpen(true);
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

  const spotlightRef = useRef<HTMLDivElement>(null);
  function handleMouseMove(e: React.MouseEvent) {
    if (spotlightRef.current) {
      spotlightRef.current.style.background =
        `radial-gradient(circle 520px at ${e.clientX}px ${e.clientY}px, rgba(249,115,22,0.13) 0%, transparent 70%)`;
    }
  }

  const userName        = session?.user?.name ?? venue?.name ?? "Lokal";
  const initials        = getInitials(userName);
  const pendingCount    = applications.filter(a => a.status === "PENDING").length;
  const acceptedWaiters = [...new Map(
    applications
      .filter(a => a.status === "ACCEPTED")
      .map(a => [a.waiter.id, { id: a.waiter.id, name: a.waiter.name }])
  ).values()];
  const today = new Date().toLocaleDateString("sr-Latn-RS", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

  const navContent = (closeMenu?: () => void, idPrefix = "tour") => (
    <>
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV_ITEMS.map(item => (
          <button key={item.key}
            id={`${idPrefix}-nav-${item.key}`}
            onClick={() => { setSection(item.key); closeMenu?.(); }}
            className={`nav-item ${section === item.key ? "active" : ""}`}>
            {item.icon}{item.label}
            {item.key === "applications" && pendingCount > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{pendingCount}</span>
            )}
            {item.key === "notifications" && notifUnread > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{notifUnread > 9 ? "9+" : notifUnread}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 mb-3">
          {venue?.logo ? (
            <Image src={venue.logo} alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-orange-500/30" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-orange-900/40 flex items-center justify-center text-orange-300 font-bold text-sm flex-shrink-0 border border-orange-500/30">{initials}</div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{venue?.name ?? userName}</div>
            <div className="text-[11px] text-white/40 truncate">Vlasnik lokala</div>
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
    <div className="flex min-h-screen" onMouseMove={handleMouseMove}
      style={{
        background: "#120a00",
        backgroundImage: [
          "linear-gradient(rgba(180,90,20,0.11) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(180,90,20,0.11) 1px, transparent 1px)",
        ].join(", "),
        backgroundSize: "40px 40px",
      }}>
      {/* Mouse spotlight overlay */}
      <div ref={spotlightRef} className="pointer-events-none fixed inset-0" style={{ zIndex: 1 }} />

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      <div
        id="tour-sidebar"
        className={`dark-sidebar fixed inset-y-0 left-0 z-50 w-64 flex flex-col md:hidden transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          background: "#0e0700",
          backgroundImage: ["linear-gradient(rgba(180,90,20,0.10) 1px, transparent 1px)", "linear-gradient(90deg, rgba(180,90,20,0.10) 1px, transparent 1px)"].join(", "),
          backgroundSize: "40px 40px",
          borderRight: "1px solid rgba(180,90,20,0.18)",
        }}>
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black text-sm">eK</div>
            <span className="font-black text-white text-base">eKonobar</span>
          </Link>
          <button onClick={() => setMobileOpen(false)}
            className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white/80">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {navContent(() => setMobileOpen(false), "mob-tour")}
      </div>

      {/* Desktop sidebar */}
      <aside id="tour-sidebar-desktop" className="dark-sidebar hidden md:flex flex-col w-60 min-h-screen sticky top-0 h-screen overflow-y-auto"
        style={{
          background: "#0e0700",
          backgroundImage: ["linear-gradient(rgba(180,90,20,0.10) 1px, transparent 1px)", "linear-gradient(90deg, rgba(180,90,20,0.10) 1px, transparent 1px)"].join(", "),
          backgroundSize: "40px 40px",
          borderRight: "1px solid rgba(180,90,20,0.18)",
          position: "relative",
          zIndex: 2,
        }}>
        <div className="px-5 py-5 border-b border-white/10">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black text-sm">eK</div>
            <span className="font-black text-white text-base">eKonobar</span>
          </Link>
        </div>
        {navContent()}
      </aside>

      <main className="flex-1 overflow-y-auto" style={{ position: "relative", zIndex: 2 }}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
          style={{ background: "rgba(18,10,0,0.88)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(180,90,20,0.2)" }}>
          <div className="flex items-center gap-3">
            <button className="md:hidden w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center hover:border-orange-400/50 transition-colors text-white"
              onClick={() => setMobileOpen(true)}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div>
              <h1 className="font-black text-white text-lg">{SECTION_TITLES[section]}</h1>
              <p className="text-xs text-orange-300/60 capitalize">{today}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div id="tour-notifications">
              <NotificationBell
                dashboardPath="/dashboard/venue"
                onViewAll={() => { setSection("notifications"); }}
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
                    Notifikacije
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
                    Odjavi se
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">
          {section === "overview"     && <OverviewSection venue={venue} posts={posts} applications={applications} loading={loading} onNavigate={setSection} geofenceEnabled={geofenceEnabled} geofenceSaving={geofenceSaving} onGeofenceToggle={toggleGeofence} onStartTour={handleStartTour} />}
          {section === "posts"        && <PostsSection posts={posts} loading={loading} onNavigate={setSection} onStatusChange={handlePostStatusChange} />}
          {section === "new-post"     && <NewPostSection venue={venue} onSuccess={() => { fetchData(); setSection("posts"); }} onBack={() => setSection("posts")} />}
          {section === "smene"        && <VenueSmeneSection venue={venue} shifts={shifts} loading={loading} acceptedWaiters={acceptedWaiters} onRefresh={fetchData} />}
          {section === "applications" && <ApplicationsSection applications={applications} loading={loading} onStatusChange={handleStatusChange} />}
          {section === "waiters"      && <WaitersSection applications={applications} loading={loading} onInvite={setInviteTarget} venue={venue} />}
          {section === "discover"     && <DiscoverSection posts={posts} onInvite={setInviteTarget} />}
          {section === "reviews"      && <ReviewsSection venue={venue} />}
          {section === "qr-review"   && <QrReviewSection venue={venue} />}
          {section === "profile"        && <ProfileSection venue={venue} loading={loading} onVenueCreated={fetchData} geofenceEnabled={geofenceEnabled} geofenceSaving={geofenceSaving} onGeofenceToggle={toggleGeofence} />}
          {section === "notifications"  && <NotificationsSection />}
        </div>
      </main>
    </div>

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
