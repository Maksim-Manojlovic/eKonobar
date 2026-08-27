/**
 * Prisma enum values, re-declared as plain `as const` objects.
 *
 * Why not just import them from `@prisma/client`?
 *
 *   - **Type-only** imports (`import type { Role } from "@prisma/client"`) are
 *     erased at compile time and are safe everywhere, mobile included.
 *   - **Runtime** values are not. `Object.values(VenueType)` pulls the generated
 *     client, which drags a Node runtime and native query engine binaries that
 *     Metro cannot bundle. The mobile app would fail at build time.
 *
 * So the values live here and the types keep coming from Prisma. That duplication
 * is only safe because `__tests__/enums.test.ts` asserts every object below
 * matches its Prisma enum exactly — adding a value to schema.prisma fails that
 * test until it is added here too. The same guard pattern already protects
 * VENUE_TYPE_LABELS.
 *
 * Each object is typed against its Prisma enum, so a typo in a value is a
 * compile error rather than a runtime surprise.
 */

import type {
  Role,
  VerificationTier,
  VenueType,
  EngagementType,
  TipSystem,
  JobPostStatus,
  ApplicationStatus,
  ReviewDirection,
  ReviewStatus,
  SanitaryStatus,
  ShiftStatus,
  ClockInMethod,
  SwapRequestStatus,
  StaffDepartment,
  StaffPosition,
  StaffStatus,
  LeaveType,
  LeaveStatus,
  NotificationType,
  ZoneType,
  InviteType,
  InviteStatus,
} from "@prisma/client";

/** Helper: an object whose values exhaust the union `T`. */
type EnumOf<T extends string> = { readonly [K in T]: K };

export const ROLES = {
  WAITER:      "WAITER",
  VENUE_OWNER: "VENUE_OWNER",
  HEADHUNTER:  "HEADHUNTER",
  ADMIN:       "ADMIN",
  GUEST:       "GUEST",
} as const satisfies EnumOf<Role>;

export const VERIFICATION_TIERS = {
  UNVERIFIED:  "UNVERIFIED",
  SILVER:      "SILVER",
  GOLD:        "GOLD",
  ID_VERIFIED: "ID_VERIFIED",
} as const satisfies EnumOf<VerificationTier>;

export const VENUE_TYPES = {
  RESTAURANT: "RESTAURANT",
  CAFE:       "CAFE",
  BAR:        "BAR",
  NIGHT_CLUB: "NIGHT_CLUB",
  CATERING:   "CATERING",
  HOTEL:      "HOTEL",
  EVENT:      "EVENT",
} as const satisfies EnumOf<VenueType>;

export const ENGAGEMENT_TYPES = {
  FULL_TIME:   "FULL_TIME",
  SEASONAL:    "SEASONAL",
  WEEKEND:     "WEEKEND",
  CELEBRATION: "CELEBRATION",
} as const satisfies EnumOf<EngagementType>;

export const TIP_SYSTEMS = {
  INDIVIDUAL:   "INDIVIDUAL",
  SHARED:       "SHARED",
  VENUE_POLICY: "VENUE_POLICY",
} as const satisfies EnumOf<TipSystem>;

export const JOB_POST_STATUSES = {
  ACTIVE:  "ACTIVE",
  PAUSED:  "PAUSED",
  FILLED:  "FILLED",
  EXPIRED: "EXPIRED",
  DELETED: "DELETED",
} as const satisfies EnumOf<JobPostStatus>;

export const APPLICATION_STATUSES = {
  PENDING:     "PENDING",
  SHORTLISTED: "SHORTLISTED",
  ACCEPTED:    "ACCEPTED",
  REJECTED:    "REJECTED",
  WITHDRAWN:   "WITHDRAWN",
  COMPLETED:   "COMPLETED",
} as const satisfies EnumOf<ApplicationStatus>;

export const REVIEW_DIRECTIONS = {
  WAITER_TO_VENUE: "WAITER_TO_VENUE",
  VENUE_TO_WAITER: "VENUE_TO_WAITER",
  GUEST_TO_WAITER: "GUEST_TO_WAITER",
  GUEST_TO_VENUE:  "GUEST_TO_VENUE",
} as const satisfies EnumOf<ReviewDirection>;

export const REVIEW_STATUSES = {
  PENDING:   "PENDING",
  PUBLISHED: "PUBLISHED",
  DISPUTED:  "DISPUTED",
  REMOVED:   "REMOVED",
} as const satisfies EnumOf<ReviewStatus>;

export const SANITARY_STATUSES = {
  PENDING:  "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  EXPIRED:  "EXPIRED",
} as const satisfies EnumOf<SanitaryStatus>;

export const SHIFT_STATUSES = {
  OPEN:         "OPEN",
  ASSIGNED:     "ASSIGNED",
  PENDING_SWAP: "PENDING_SWAP",
  LOCKED:       "LOCKED",
  COMPLETED:    "COMPLETED",
  CANCELLED:    "CANCELLED",
} as const satisfies EnumOf<ShiftStatus>;

export const CLOCK_IN_METHODS = {
  GPS:       "GPS",
  GPS_GRACE: "GPS_GRACE",
  QR:        "QR",
  MANUAL:    "MANUAL",
} as const satisfies EnumOf<ClockInMethod>;

export const SWAP_REQUEST_STATUSES = {
  PENDING:   "PENDING",
  ACCEPTED:  "ACCEPTED",
  REJECTED:  "REJECTED",
  CANCELLED: "CANCELLED",
} as const satisfies EnumOf<SwapRequestStatus>;

export const STAFF_DEPARTMENTS = {
  FOH: "FOH",
  BOH: "BOH",
} as const satisfies EnumOf<StaffDepartment>;

export const STAFF_POSITIONS = {
  WAITER:        "WAITER",
  SENIOR_WAITER: "SENIOR_WAITER",
  HEAD_WAITER:   "HEAD_WAITER",
  BARTENDER:     "BARTENDER",
  BARISTA:       "BARISTA",
  RUNNER:        "RUNNER",
  HOST:          "HOST",
  SOMMELIER:     "SOMMELIER",
  HEAD_CHEF:     "HEAD_CHEF",
  SOUS_CHEF:     "SOUS_CHEF",
  LINE_COOK:     "LINE_COOK",
  PREP_COOK:     "PREP_COOK",
  PASTRY_CHEF:   "PASTRY_CHEF",
  GRILL_COOK:    "GRILL_COOK",
  DISHWASHER:    "DISHWASHER",
} as const satisfies EnumOf<StaffPosition>;

/**
 * Positions per department, seniority-first.
 *
 * Order is the picker order, so the roles an owner assigns most deliberately
 * come before the entry-level ones. Kept here rather than in the web app because
 * both the roster screen and the mobile Ekipa screen render the same picker;
 * `apps/web/src/lib/staff/positions.ts` re-exports these.
 */
export const FOH_POSITIONS = [
  "HEAD_WAITER", "SENIOR_WAITER", "WAITER", "BARTENDER",
  "BARISTA", "SOMMELIER", "HOST", "RUNNER",
] as const satisfies readonly StaffPosition[];

export const BOH_POSITIONS = [
  "HEAD_CHEF", "SOUS_CHEF", "LINE_COOK", "GRILL_COOK",
  "PASTRY_CHEF", "PREP_COOK", "DISHWASHER",
] as const satisfies readonly StaffPosition[];

export const STAFF_STATUSES = {
  ACTIVE:    "ACTIVE",
  SUSPENDED: "SUSPENDED",
  ENDED:     "ENDED",
} as const satisfies EnumOf<StaffStatus>;

export const LEAVE_TYPES = {
  ANNUAL:   "ANNUAL",
  SICK:     "SICK",
  UNPAID:   "UNPAID",
  PARENTAL: "PARENTAL",
  SPECIAL:  "SPECIAL",
} as const satisfies EnumOf<LeaveType>;

export const LEAVE_STATUSES = {
  PENDING:   "PENDING",
  APPROVED:  "APPROVED",
  REJECTED:  "REJECTED",
  CANCELLED: "CANCELLED",
} as const satisfies EnumOf<LeaveStatus>;

export const NOTIFICATION_TYPES = {
  APPLICATION_RECEIVED:       "APPLICATION_RECEIVED",
  APPLICATION_STATUS_CHANGED: "APPLICATION_STATUS_CHANGED",
  SWAP_REQUESTED:             "SWAP_REQUESTED",
  SWAP_RESOLVED:              "SWAP_RESOLVED",
  SHIFT_CLAIMED:              "SHIFT_CLAIMED",
  SHIFT_ASSIGNED:             "SHIFT_ASSIGNED",
  REVIEW_RECEIVED:            "REVIEW_RECEIVED",
  REVIEW_PUBLISHED:           "REVIEW_PUBLISHED",
  CLOCKIN_APPROVAL_REQUESTED: "CLOCKIN_APPROVAL_REQUESTED",
  CLOCKIN_RESOLVED:           "CLOCKIN_RESOLVED",
  RED_ALERT_POSTED:           "RED_ALERT_POSTED",
  LEAVE_REQUESTED:            "LEAVE_REQUESTED",
  LEAVE_RESOLVED:             "LEAVE_RESOLVED",
  LEAVE_CANCELLED:            "LEAVE_CANCELLED",
} as const satisfies EnumOf<NotificationType>;

export const ZONE_TYPES = {
  FESTIVAL_ZONE: "FESTIVAL_ZONE",
  TRANSIT_HUB:   "TRANSIT_HUB",
  DEVELOPMENT:   "DEVELOPMENT",
  NIGHTLIFE:     "NIGHTLIFE",
  TOURIST_AREA:  "TOURIST_AREA",
  STUDENT_AREA:  "STUDENT_AREA",
  RESIDENTIAL:   "RESIDENTIAL",
} as const satisfies EnumOf<ZoneType>;

export const INVITE_TYPES = {
  VERIFICATION: "VERIFICATION",
  JOB_INVITE:   "JOB_INVITE",
} as const satisfies EnumOf<InviteType>;

export const INVITE_STATUSES = {
  PENDING:  "PENDING",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  EXPIRED:  "EXPIRED",
} as const satisfies EnumOf<InviteStatus>;

// ── Value-derived types ───────────────────────────────────────────────────────
//
// The unions above are also available from @prisma/client, but apps/mobile has no
// reason to depend on the Prisma package at all — not even for types — so the
// unions are re-derived from the objects here. Identical by construction, since
// the objects are `satisfies EnumOf<PrismaEnum>` and the parity test enforces it.

export type RoleValue              = (typeof ROLES)[keyof typeof ROLES];
export type VerificationTierValue  = (typeof VERIFICATION_TIERS)[keyof typeof VERIFICATION_TIERS];
export type VenueTypeValue         = (typeof VENUE_TYPES)[keyof typeof VENUE_TYPES];
export type ApplicationStatusValue = (typeof APPLICATION_STATUSES)[keyof typeof APPLICATION_STATUSES];
export type ShiftStatusValue       = (typeof SHIFT_STATUSES)[keyof typeof SHIFT_STATUSES];
export type NotificationTypeValue  = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];
export type ReviewDirectionValue   = (typeof REVIEW_DIRECTIONS)[keyof typeof REVIEW_DIRECTIONS];
export type InviteStatusValue      = (typeof INVITE_STATUSES)[keyof typeof INVITE_STATUSES];
export type LeaveStatusValue       = (typeof LEAVE_STATUSES)[keyof typeof LEAVE_STATUSES];
