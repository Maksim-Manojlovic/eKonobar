import type { VenueZoneInsights } from "@/lib/geo/analytics";

// Waiter-analytics response shapes are computed in the pure lib; re-export so
// the client and server share one source of truth (the lib has no server deps).
export type { WaiterAnalytics, WaiterReliability, WaiterFlag, AnalyticsTeamSummary, GuestRating } from "@/lib/analytics/waiter-analytics";

export type Section = "overview" | "posts" | "new-post" | "smene" | "tim" | "odmori" | "applications" | "waiters" | "discover" | "reviews" | "qr-review" | "analitika" | "profile" | "notifications";
export type AppFilter = "SVE" | "PENDING" | "SHORTLISTED" | "ACCEPTED" | "REJECTED";

export type VenueShiftAssignment = {
  id: string;
  waiterId: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockInMethod: string | null;
  lateMinutes: number | null;
  pendingClockIn: boolean;
  waiter: { id: string; name: string | null };
};

export type VenueSwapRequest = {
  id: string;
  status: string;
  requestedAt: string;
  fromAssignment: { id: string; waiter: { id: string; name: string | null } };
  toWaiter: { id: string; name: string | null };
};

export type VenueShift = {
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

export type TemplateMeta = { type?: "morning" | "evening"; label?: string; shift?: "1" | "2" };
export type ShiftTemplate = {
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

export type Venue = {
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
  isActive: boolean;
  venueInsights?: VenueZoneInsights | null;
  images: string[];
  logo?: string | null;
  headWaiterId: string | null;
  headWaiter: { id: string; name: string | null } | null;
  headChefId?: string | null;
  /** null = derive from venueType; see hasKitchen() in lib/staff/positions.ts */
  kitchenEnabled?: boolean | null;
  _count: { jobPosts: number };
  venueTrustScore: {
    atmosphere: number; organization: number; pay: number;
    tips: number; hygieneStandards: number; management: number;
    composite: number; sampleSize: number;
  } | null;
};

/* ── Staff roster (GET /api/venues/[id]/staff) ───────────────────────────── */

export type StaffMember = {
  id: string;
  position: string;
  department: "FOH" | "BOH";
  status: "ACTIVE" | "SUSPENDED" | "ENDED";
  employmentType: string;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  waiter: {
    id: string;
    name: string | null;
    image: string | null;
    verificationTier: string;
    waiterPassport: { score: number; sanitaryBookValid: boolean } | null;
  };
};

export type StaffResponse = {
  staff: StaffMember[];
  hasKitchen: boolean;
  canManage: boolean;
};

/* ── Odmori (GET /api/leave/blackouts, /api/leave/policy) ────────────────── */

export type BlackoutDate = {
  id: string;
  department: "FOH" | "BOH";
  /** YYYY-MM-DD — never a timestamp; see lib/leave/dates.ts */
  date: string;
  /** 0 = fully blocked; >0 = reduced cap for that day */
  maxOff: number;
  reason: string | null;
};

export type BlackoutsResponse = {
  blackouts: BlackoutDate[];
  departments: ("FOH" | "BOH")[];
  hasKitchen: boolean;
  canManageBlackouts: boolean;
};

export type LeavePolicyRow = {
  department: "FOH" | "BOH";
  /** false = no row stored, these are the platform defaults */
  configured: boolean;
  annualDays: number;
  maxConcurrentOff: number;
  minNoticeDays: number;
  autoApprove: boolean;
  countWeekends: boolean;
  allowCarryOver: boolean;
  carryOverDays: number;
  carryOverDeadline: string;
};

export type LeaveRequestRow = {
  id: string;
  type: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  year: number;
  days: number;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  department: "FOH" | "BOH";
  reason: string | null;
  attachmentUrl: string | null;
  rejectReason: string | null;
  autoApproved: boolean;
  reviewedAt: string | null;
  createdAt: string;
  waiter: { id: string; name: string | null; image: string | null };
  staff: { position: string };
  venue: { id: string; name: string };
  /** Only present on the create response, explaining why it was queued. */
  pendingReason?: string | null;
};

export type LeaveRequestsResponse = {
  requests: LeaveRequestRow[];
  scope: "own" | "manage";
  departments?: ("FOH" | "BOH")[];
  hasKitchen?: boolean;
};

export type LeavePolicyResponse = {
  policies: LeavePolicyRow[];
  hasKitchen: boolean;
  canManagePolicy: boolean;
  defaults: Omit<LeavePolicyRow, "department" | "configured">;
};

export type VenueReview = {
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
  ratingPay: number | null;
  ratingTips: number | null;
  ratingHygieneWork: number | null;
  ratingManagement: number | null;
  ratingFriendliness: number | null;
  ratingGuestSpeed: number | null;
  ratingAttentiveness: number | null;
};

export type OwnPost = {
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

export type WaiterEntry = {
  id: string;
  name: string | null;
  image?: string | null;
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
  } | null;
};

export type IncomingApp = {
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



export type SentInvite = {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  expiresAt: string;
  recipient: { id: string; name: string | null; verificationTier: string };
};

/** Waiter shape used in the venue invites search panel */
export type VenueInviteWaiter = {
  id: string;
  name: string | null;
  verificationTier: string;
  waiterPassport: { score: number; currentlyAvailable: boolean; sanitaryBookValid: boolean } | null;
};

