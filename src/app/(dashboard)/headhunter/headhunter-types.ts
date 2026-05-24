export type WaiterPassport = {
  score: number;
  skills: string[];
  languages: string[];
  yearsExperience: number;
  sanitaryBookValid: boolean;
  currentlyAvailable: boolean;
  reviewCount: number;
  totalEngagements: number;
  shareToken?: string | null;
  passportTier?: string;
  subscriptionExpiresAt?: string | null;
};

/** Full waiter shape returned by GET /api/waiters */
export type Waiter = {
  id: string;
  name?: string | null;
  image?: string | null;
  verificationTier: string;
  waiterPassport?: WaiterPassport | null;
};

/** Entry returned by GET /api/headhunter/saved */
export type SavedEntry = {
  savedAt: string;
  notes?: string | null;
  waiter: Waiter;
};
