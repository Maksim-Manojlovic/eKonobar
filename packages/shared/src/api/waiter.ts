/**
 * Response shapes for the waiter-facing API routes.
 *
 * These are the contract between the server and BOTH clients, so they live here
 * rather than in either app. A type that exists twice drifts the moment a route
 * adds a field: the web dashboard picks it up, the phone silently does not, and
 * nothing fails until a screen renders undefined.
 *
 * Types only — no runtime values, and nothing UI-specific. Section/AppFilter and
 * anything else describing a particular client's navigation stay in that client.
 */

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
  profilePhoto: string | null;
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
  workMunicipalities: string[];
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

export type MarketData = {
  openPositions: number;
  redAlertCount: number;
  avgSalaryMin: number | null;
  avgSalaryMax: number | null;
  topMunicipalities: { name: string; count: number }[];
};

/* ── Odmori (GET /api/leave/balance, /api/leave/requests) ────────────────── */

export type LeaveBalanceEntry = {
  staffId: string;
  venue: { id: string; name: string; logo: string | null };
  department: "FOH" | "BOH";
  position: string;
  year: number;
  entitledDays: number;
  carriedInDays: number;
  usedDays: number;
  pendingDays: number;
  sickDaysTaken: number;
  /** entitled + carriedIn − used − pending */
  remainingDays: number;
  policy: {
    annualDays: number;
    minNoticeDays: number;
    countWeekends: boolean;
    autoApprove: boolean;
  };
};

export type LeaveBalanceResponse = {
  year: number;
  balances: LeaveBalanceEntry[];
};

export type WaiterLeaveRequest = {
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
  venue: { id: string; name: string };
  staff: { position: string };
};

