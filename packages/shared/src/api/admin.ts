/**
 * Response shapes for the admin routes the mobile approvals inbox uses.
 *
 * Only the three surfaces that belong on a phone: sanitary-book verifications,
 * disputed reviews, and system health. User management, zone analytics and the
 * charts stay on the web dashboard by design (mobile-app-plan §11).
 */

/** GET /api/verification/sanitary as ADMIN — PENDING submissions, oldest first. */
export type SanitaryPending = {
  id:           string;
  status:       string;
  expiryDate:   string | null;
  uploadedAt:   string;
  rejectReason: string | null;
  reviewedBy:   string | null;
  reviewedAt:   string | null;
  /** fileUrl is deliberately absent — the document is served by an auth-gated endpoint. */
  user: { id: string; name: string | null; email: string };
};

/** GET /api/admin/reviews — DISPUTED reviews, newest first. */
export type DisputedReview = {
  id:            string;
  direction:     string;
  status:        string;
  overallRating: number;
  comment:       string | null;
  createdAt:     string;
  publishedAt:   string | null;
  venueId:       string | null;
  subjectId:     string | null;
  /** null for guest reviews — Review.authorId is nullable by design. */
  author:  { id: string; name: string | null; email: string; verificationTier: string } | null;
  venue:   { id: string; name: string; municipality: string } | null;
  subject: { id: string; name: string | null } | null;
};

/**
 * GET /api/admin/health.
 *
 * Keep this in step with the route. It previously declared `passports.expiredPaid`
 * and `cron.lastRenewalPaymentAt`, which were removed along with the waiter
 * subscription product — the route stopped returning `passports` entirely, so the
 * web dashboard was reading `undefined.expiredPaid` and threw on render.
 * TypeScript could not catch that: the response is parsed from JSON and asserted
 * into this type, so a declaration that lies about the shape is simply believed.
 */
export type HealthData = {
  reviews: { overdueGuest: number; overdueRegular: number };
  cron:    { lastPublishedReviewAt: string | null };
  users:   { softDeleted: number };
  system:  { rateLimitEntries: number; pendingClockIns: number };
  /** null when REDIS_URL is not configured. */
  redis:   { connected: boolean; latencyMs: number | null } | null;
  db:      {
    pingMs:          number | null;
    poolSize:        number;
    connectionsOpen: number | null;
    connectionsBusy: number | null;
    saturation:      number | null;
  } | null;
};
