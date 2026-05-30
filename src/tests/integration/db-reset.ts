import { dbRaw } from "@/lib/core/db";

/**
 * Truncates every application table in a single PostgreSQL round-trip.
 * RESTART IDENTITY resets sequences; CASCADE resolves FK ordering automatically.
 * ~5 ms on a local PostgreSQL 15 instance with an open connection pool.
 *
 * Usage in integration test files:
 *   import { resetDb } from "@/tests/integration/db-reset";
 *   beforeEach(async () => { await resetDb(); });
 */
export async function resetDb(): Promise<void> {
  await dbRaw.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AuditLog",
      "TokenRevocation",
      "PasswordResetToken",
      "AnonRateLimit",
      "RateLimit",
      "PushSubscription",
      "Notification",
      "PassportPayment",
      "ShiftSwapRequest",
      "ShiftAssignment",
      "Shift",
      "ShiftTemplate",
      "VenueZoneRelation",
      "VenueZone",
      "SavedProfile",
      "Invite",
      "SanitaryBook",
      "EngagementRecord",
      "PassportTrustScore",
      "WaiterPassport",
      "VenueTrustScore",
      "Review",
      "JobApplication",
      "JobPost",
      "Venue",
      "Session",
      "Account",
      "VerificationToken",
      "User"
    RESTART IDENTITY CASCADE
  `);
}

/**
 * Seed a minimal Venue row. Returns the created venue's id.
 */
export async function seedVenue(
  ownerId: string,
  overrides: Partial<{
    name:            string;
    geofenceEnabled: boolean;
    reviewRadiusKm:  number;
    latitude:        number;
    longitude:       number;
  }> = {},
): Promise<string> {
  const venue = await dbRaw.venue.create({
    data: {
      ownerId,
      name:            overrides.name            ?? "Test Venue",
      address:         "Test Address",
      municipality:    "Beograd",
      venueType:       "RESTAURANT",
      latitude:        overrides.latitude         ?? 44.8176,
      longitude:       overrides.longitude        ?? 20.4569,
      reviewRadiusKm:  overrides.reviewRadiusKm   ?? 0.15,
      geofenceEnabled: overrides.geofenceEnabled  ?? false,
    },
  });
  return venue.id;
}

/**
 * Seed a WaiterPassport row for a WAITER user. Returns the passport's id.
 */
export async function seedPassport(
  userId: string,
  overrides: Partial<{
    passportTier:          "FREE" | "PRO" | "PRO_PLUS";
    subscriptionExpiresAt: Date | null;
  }> = {},
): Promise<string> {
  const passport = await dbRaw.waiterPassport.create({
    data: {
      userId,
      passportTier:          overrides.passportTier          ?? "FREE",
      subscriptionExpiresAt: overrides.subscriptionExpiresAt ?? null,
    },
  });
  return passport.id;
}

/**
 * Seed a minimal User row for integration tests that need an authenticated actor.
 * Returns the created user's id.
 */
export async function seedUser(overrides: {
  email?: string;
  role?: "WAITER" | "VENUE_OWNER" | "HEADHUNTER" | "ADMIN";
  name?: string;
} = {}): Promise<string> {
  const user = await dbRaw.user.create({
    data: {
      email: overrides.email ?? `test-${crypto.randomUUID()}@integration.local`,
      name:  overrides.name  ?? "Integration Test User",
      role:  overrides.role  ?? "WAITER",
    },
  });
  return user.id;
}
