import { dbRaw } from "@/lib/core/db";

/**
 * Refuses to truncate anything that is not obviously a throwaway database.
 *
 * `resetDb()` TRUNCATEs every application table and reads whatever `DATABASE_URL`
 * happens to be in `.env`. On a developer machine that variable routinely points
 * at the shared Supabase instance — so a stray `npm run test:integration` wipes
 * production with no prompt and no undo. The cost of being wrong here is total
 * and irreversible, so the default is to refuse.
 *
 * A host is considered safe when it is loopback, a Docker Compose service name,
 * or the database name is explicitly marked as a test database. Anything else
 * (Supabase, RDS, Neon, Railway …) requires `ALLOW_DESTRUCTIVE_DB_RESET=1`,
 * which CI sets against its own ephemeral database.
 */
const SAFE_HOSTS = ["localhost", "127.0.0.1", "::1", "db", "postgres", "postgresql"];

export function assertResettableDatabase(rawUrl = process.env.DATABASE_URL): void {
  if (process.env.ALLOW_DESTRUCTIVE_DB_RESET === "1") return;

  if (!rawUrl) {
    throw new Error("[db-reset] DATABASE_URL is not set — refusing to TRUNCATE.");
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("[db-reset] DATABASE_URL is not a parseable URL — refusing to TRUNCATE.");
  }

  const host   = url.hostname.toLowerCase();
  const dbName = url.pathname.replace(/^\//, "").toLowerCase();

  const hostIsLocal  = SAFE_HOSTS.includes(host);
  const nameIsTestDb = dbName.includes("test");

  if (hostIsLocal || nameIsTestDb) return;

  throw new Error(
    `[db-reset] REFUSING to TRUNCATE every table on host "${host}" (database "${dbName}").\n` +
    `This does not look like a local or test database, and resetDb() is irreversible.\n` +
    `Run integration tests against Docker Compose:\n` +
    `  docker compose up -d && npm run db:push\n` +
    `If this really is a throwaway database, set ALLOW_DESTRUCTIVE_DB_RESET=1.`,
  );
}

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
  assertResettableDatabase();
  await dbRaw.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AuditLog",
      "MobileRefreshToken",
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
    score:              number;
    currentlyAvailable: boolean;
    workMunicipalities: string[];
  }> = {},
): Promise<string> {
  const passport = await dbRaw.waiterPassport.create({
    data: {
      userId,
      score:              overrides.score              ?? 0,
      currentlyAvailable: overrides.currentlyAvailable ?? true,
      workMunicipalities: overrides.workMunicipalities ?? [],
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
  /** Pass a bcrypt hash to make the user able to sign in (password login tests). */
  hashedPassword?: string;
} = {}): Promise<string> {
  const user = await dbRaw.user.create({
    data: {
      email:          overrides.email ?? `test-${crypto.randomUUID()}@integration.local`,
      name:           overrides.name  ?? "Integration Test User",
      role:           overrides.role  ?? "WAITER",
      hashedPassword: overrides.hashedPassword ?? null,
    },
  });
  return user.id;
}
