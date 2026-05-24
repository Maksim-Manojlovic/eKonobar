import type { VenueZoneInsights } from "@/lib/analytics";
export { formatDate } from "@/lib/display-maps";

export type Section = "overview" | "posts" | "new-post" | "smene" | "applications" | "waiters" | "discover" | "reviews" | "qr-review" | "profile" | "notifications";
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

export const DAYS_SR   = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
export const MONTHS_SR = ["Januar", "Februar", "Mart", "April", "Maj", "Jun",
                          "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"];

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
  _count: { jobPosts: number };
  venueTrustScore: {
    atmosphere: number; organization: number; pay: number;
    tips: number; hygieneStandards: number; management: number;
    composite: number; sampleSize: number;
  } | null;
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
  ratingHygieneWork: number | null;
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
    passportTier?: string;
    subscriptionExpiresAt?: string | null;
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


export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export function formatSalary({ salaryMin, salaryMax, engagementType }: Pick<OwnPost, "salaryMin" | "salaryMax" | "engagementType">): string {
  if (!salaryMin && !salaryMax) return "Po dogovoru";
  const sfx = engagementType === "FULL_TIME" ? "/mes" : "/sm";
  if (salaryMin && salaryMax) return `${salaryMin.toLocaleString("sr-RS")} – ${salaryMax.toLocaleString("sr-RS")} RSD${sfx}`;
  if (salaryMin) return `od ${salaryMin.toLocaleString("sr-RS")} RSD${sfx}`;
  return `do ${salaryMax!.toLocaleString("sr-RS")} RSD${sfx}`;
}

// formatDate is re-exported above from @/lib/display-maps

export function trustDimensions(ts: Venue["venueTrustScore"]): { label: string; value: number }[] {
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
