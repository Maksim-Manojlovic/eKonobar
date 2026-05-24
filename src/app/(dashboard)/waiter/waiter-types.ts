// Types, constants, and utility functions for the Waiter dashboard.
// No JSX — safe to import in both client and server contexts.
export { formatDate } from "@/lib/display-maps";

export type Section = "overview" | "alerts" | "jobs" | "applications" | "shifts" | "invites" | "reviews" | "passport" | "manage" | "notifications";
export type AppFilter = "all" | "accepted" | "pending" | "rejected";

export type ShiftAssignment = {
  id: string;
  waiterId: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockInMethod: string | null;
  lateMinutes: number | null;
  earlyExitAt: string | null;
  pendingClockIn: boolean;
};

export type WaiterShift = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  scheduledStart: string | null;
  role: string | null;
  pay: number | null;
  notes: string | null;
  briefingNote: string | null;
  tipEstimate: number | null;
  status: string;
  requiredCount: number;
  venue: { id: string; name: string; address: string; municipality: string };
  assignments: ShiftAssignment[];
};

export type OpenShift = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string | null;
  pay: number | null;
  tipEstimate: number | null;
  requiredCount: number;
  venue: { id: string; name: string; address: string; municipality: string };
  assignments: { waiterId: string }[];
};

export type SwapRequest = {
  id: string;
  requestedAt: string;
  shift: {
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    venue: { id: string; name: string; address: string; municipality: string };
  };
  fromAssignment: { waiter: { id: string; name: string | null } };
};

export type ManagedShiftAssignment = {
  id: string;
  waiterId: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockInMethod: string | null;
  lateMinutes: number | null;
  waiter: { id: string; name: string | null };
};

export type ManagedSwapRequest = {
  id: string;
  status: string;
  requestedAt: string;
  fromAssignment: { id: string; waiter: { id: string; name: string | null } };
  toWaiter: { id: string; name: string | null };
};

export type ManagedShift = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  requiredCount: number;
  pay: number | null;
  tipEstimate: number | null;
  briefingNote: string | null;
  status: string;
  swapLocked: boolean;
  assignments: ManagedShiftAssignment[];
  swapRequests: ManagedSwapRequest[];
};

export const DAYS_SR   = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
export const MONTHS_SR = ["Januar", "Februar", "Mart", "April", "Maj", "Jun",
                          "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"];

export type JobPost = {
  id: string;
  title: string;
  engagementType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  redAlert: boolean;
  redAlertNote: string | null;
  status: string;
  createdAt: string;
  venue: {
    id: string;
    name: string;
    address: string;
    municipality: string;
    trustScore: number;
  };
  _count: { applications: number };
};

export type InviteItem = {
  id: string;
  status: string;
  message: string | null;
  jobPostId: string | null;
  venueId: string | null;
  expiresAt: string;
  createdAt: string;
  sender: {
    id: string;
    name: string | null;
    venues: { id: string; name: string }[];
  };
};

export type RecentReview = {
  id: string;
  overallRating: number;
  comment: string;
  publishedAt: string;
  author: { name: string | null; venues: { name: string }[] };
};

export type PassportData = {
  id: string;
  score: number;
  badges: string[];
  reviewCount: number;
  totalEngagements: number;
  avgEngagementMonths: number;
  skills: string[];
  languages: string[];
  yearsExperience: number;
  sanitaryBookValid: boolean;
  currentlyAvailable: boolean;
  bio: string | null;
  galleryPhotos: string[];
  venueTypePreferences: string[];
  lastAvailableDate: string | null;
  avgRedAlertResponseMinutes: number | null;
  redAlertResponseCount: number;
  recentReviews: RecentReview[];
  trustScore: {
    punctuality: number; skill: number; guestCommunication: number;
    personalHygiene: number; teamwork: number; speed: number;
    composite: number; sampleSize: number;
  } | null;
};

export type PassportSubscription = {
  tier: "FREE" | "PRO" | "PRO_PLUS";
  subscriptionExpiresAt: string | null;
  isActive: boolean;
  daysRemaining: number;
};

export type MyApplication = {
  id: string;
  status: string;
  appliedAt: string;
  jobPost: {
    id: string;
    title: string;
    venue: { id: string; name: string; address: string; municipality: string };
  };
};

export type WaiterReview = {
  id: string;
  direction: string;
  overallRating: number;
  comment: string | null;
  publishedAt: string | null;
  author: { id: string; name: string | null; verificationTier: string };
};

/* ── Utility ──────────────────────────────────────────────────────────────── */

export const ENGAGEMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Stalno", SEASONAL: "Sezonski", WEEKEND: "Vikend", CELEBRATION: "Slavlje",
};

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export function formatSalary({ salaryMin, salaryMax, engagementType }: Pick<JobPost, "salaryMin" | "salaryMax" | "engagementType">): string {
  if (!salaryMin && !salaryMax) return "Po dogovoru";
  const sfx = engagementType === "FULL_TIME" ? "/mes" : "/sm";
  if (salaryMin && salaryMax) return `${salaryMin.toLocaleString("sr-RS")} – ${salaryMax.toLocaleString("sr-RS")} RSD${sfx}`;
  if (salaryMin) return `od ${salaryMin.toLocaleString("sr-RS")} RSD${sfx}`;
  return `do ${salaryMax!.toLocaleString("sr-RS")} RSD${sfx}`;
}

export function appStatusKey(status: string): "accepted" | "pending" | "rejected" {
  if (status === "ACCEPTED" || status === "COMPLETED") return "accepted";
  if (status === "REJECTED" || status === "WITHDRAWN") return "rejected";
  return "pending";
}

// formatDate is re-exported above from @/lib/display-maps

/* ── Tier helpers ────────────────────────────────────────────────────────── */

export const TIER_BADGE: Record<string, { label: string; cls: string }> = {
  BRONZE:   { label: "BRONZE",      cls: "bg-orange-100 text-orange-700" },
  SILVER:   { label: "SILVER",      cls: "bg-neutral-200 text-neutral-600" },
  GOLD:     { label: "🥇 GOLD",     cls: "bg-amber-100 text-amber-700" },
  PLATINUM: { label: "💎 PLATINUM", cls: "bg-blue-100 text-blue-700" },
};

export const NEXT_TIER: Record<string, string | null> = {
  BRONZE: "SILVER", SILVER: "GOLD", GOLD: "PLATINUM", PLATINUM: null,
};

/* ── Market Insights ─────────────────────────────────────────────────────── */

export type MarketData = {
  openPositions: number;
  redAlertCount: number;
  avgSalaryMin: number | null;
  avgSalaryMax: number | null;
  topMunicipalities: { name: string; count: number }[];
};

/* ── Direction labels ─────────────────────────────────────────────────────── */

export const DIRECTION_LABELS: Record<string, string> = {
  VENUE_TO_WAITER: "Lokal",
  GUEST_TO_WAITER: "Gost",
};

/* ── Passport constants ───────────────────────────────────────────────────── */

export const BADGE_META: Record<string, { emoji: string; label: string; sub: string }> = {
  sanitarna:        { emoji: "🧪", label: "Sanitarna knjižica", sub: "Verifikovan dokument" },
  sommelier:        { emoji: "🍷", label: "Somelijer",           sub: "Kurs završen" },
  english_b2:       { emoji: "🌍", label: "Engleski B2",         sub: "Jezik potvrđen" },
  verified_history: { emoji: "📋", label: "Verified History",    sub: "3+ verifikovane smene" },
  hospitality_pro:  { emoji: "🏅", label: "Hospitality Pro",     sub: "50 smena potrebno" },
  platinum:         { emoji: "💎", label: "Platinum Waiter",     sub: "Skor 98+ potreban" },
};

export const BADGE_PROGRESS: Record<string, ((p: PassportData) => { current: number; total: number; unit: string }) | null> = {
  verified_history: (p) => ({ current: Math.min(p.totalEngagements, 3),  total: 3,  unit: "smena" }),
  hospitality_pro:  (p) => ({ current: Math.min(p.totalEngagements, 50), total: 50, unit: "smena" }),
  platinum:         (p) => ({ current: Math.min(Math.round(p.score), 98), total: 98, unit: "skor" }),
  sanitarna:        null,
  sommelier:        null,
  english_b2:       null,
};

export const VENUE_TYPE_OPTIONS = [
  { value: "RESTAURANT", label: "Restoran" },
  { value: "CAFE",       label: "Kafić" },
  { value: "BAR",        label: "Bar" },
  { value: "NIGHT_CLUB", label: "Noćni klub" },
  { value: "HOTEL",      label: "Hotel" },
  { value: "CATERING",   label: "Ketering" },
];

export const SCORE_DIMS: { key: keyof NonNullable<PassportData["trustScore"]>; label: string }[] = [
  { key: "punctuality",         label: "Tačnost" },
  { key: "skill",               label: "Veštine" },
  { key: "guestCommunication",  label: "Komunikacija" },
  { key: "personalHygiene",     label: "Higijena" },
  { key: "teamwork",            label: "Tim" },
  { key: "speed",               label: "Brzina" },
];

/* ── Navigation ──────────────────────────────────────────────────────────── */

export const SECTION_TITLES: Record<Section, string> = {
  overview: "Pregled", alerts: "Red Alert", jobs: "Dostupni poslovi",
  applications: "Moje prijave", shifts: "Smene", invites: "Pozivnice",
  reviews: "Recenzije", passport: "Waiter Passport™", manage: "Šef konobara",
  notifications: "Obaveštenja",
};
