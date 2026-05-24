/** Types and display constants for the admin dashboard. */

/* ── Domain types ────────────────────────────────────────────────────────── */

export type PlatformStats = {
  users:        { waiters: number; venueOwners: number; headhunters: number; admins: number; total: number };
  passports:    { total: number; free: number; pro: number; proPlus: number; available: number; verified: number };
  venues:       number;
  jobs:         { open: number; redAlert: number };
  applications: { total: number; pending: number };
  reviews:      { pending: number; published: number; disputed: number; removed: number };
  sanitary:     { pending: number };
  payments:     { totalSuccess: number; revenueThisMonth: number };
};

export type ActionStats = {
  pendingVerifications: number;
  disputedReviews:      number;
  zones:                number;
  venues:               number;
};

export type ActivityEvent = {
  id: string; type: string; title: string; sub: string; ts: string; link?: string;
};

export type LeaderboardData = {
  topWaiters: {
    id: string; name: string | null; image: string | null;
    verificationTier: string; score: number; passportTier: string;
    isActive: boolean; reviewCount: number; totalEngagements: number;
  }[];
  topVenues: {
    id: string; name: string; municipality: string | null;
    logo: string | null; score: number; reviewCount: number;
  }[];
  revenue: { date: string; revenue: number }[];
};

export type HealthData = {
  reviews:  { overdueGuest: number; overdueRegular: number };
  passports: { expiredPaid: number };
  cron:     { lastPublishedReviewAt: string | null; lastRenewalPaymentAt: string | null };
  users:    { softDeleted: number };
  system:   { rateLimitEntries: number; pendingClockIns: number };
};

/* ── Activity feed display maps ──────────────────────────────────────────── */

export const EVENT_ICONS: Record<string, string> = {
  registration: "👤",
  payment:      "💳",
  review:       "⭐",
  application:  "📝",
};

export const EVENT_COLORS: Record<string, string> = {
  registration: "text-blue-400",
  payment:      "text-emerald-400",
  review:       "text-amber-400",
  application:  "text-orange-400",
};

/* ── Nav config ──────────────────────────────────────────────────────────── */

export const NAV = [
  {
    href:       "/admin/verifications",
    icon:       "📋",
    title:      "Sanitarne knjižice",
    desc:       "Pregled i odobravanje zahteva za verifikaciju.",
    countKey:   "pendingVerifications" as keyof ActionStats,
    countLabel: "na čekanju",
    alert:      true,
  },
  {
    href:       "/admin/moderation",
    icon:       "🔍",
    title:      "Moderacija recenzija",
    desc:       "Disputed recenzije — objavi ili ukloni.",
    countKey:   "disputedReviews" as keyof ActionStats,
    countLabel: "na pregledu",
    alert:      true,
  },
  {
    href:       "/admin/analytics/zones",
    icon:       "🗺️",
    title:      "Zone analitike",
    desc:       "Upravljanje investicionim i komercijalnim zonama.",
    countKey:   "zones" as keyof ActionStats,
    countLabel: "zona",
    alert:      false,
  },
  {
    href:       "/admin/venues",
    icon:       "🏪",
    title:      "Upravljanje lokalima",
    desc:       "Pretraži, filtriraj i trajno obriši lokale.",
    countKey:   "venues" as keyof ActionStats,
    countLabel: "lokala",
    alert:      false,
  },
];
