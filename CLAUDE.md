# eKonobar — Claude Instructions

## Project

Next.js 15 (App Router) hospitality platform for Serbia. Waiters get a verified digital passport, venue owners post jobs and verify staff, headhunters search talent. Built with Prisma + PostgreSQL, NextAuth JWT, Mapbox, Bayesian trust scoring.

Architecture design notes are in [ekonobar-architecture.md](ekonobar-architecture.md).

## Commands

```bash
npm run dev              # start dev server (port 3000)
npm run db:push          # push schema changes (no migration file)
npm run db:generate      # regenerate Prisma client after schema changes
npm run db:migrate       # create named migration
npm run db:seed          # seed demo data
npm run db:studio        # Prisma Studio GUI
npm test                 # run unit tests (Vitest)
npm run test:watch       # run tests in watch mode
```

## Critical Patterns

### db vs dbRaw

`db` (from `lib/db.ts`) applies a global soft-delete filter — it never returns rows where `deletedAt IS NOT NULL`. Use it everywhere except:
- `lib/sync-scores.ts` — needs all rows for score recalculation
- Admin routes — need to see and restore deleted records
- `lib/rate-limit.ts` — uses `dbRaw` directly

Use `dbRaw` for those cases.

### Prisma JSON null

To clear a JSON field (e.g., `venueInsights`), use `Prisma.DbNull`, not `null`. Passing `null` does nothing.

```typescript
import { Prisma } from '@prisma/client';
await db.venue.update({ where: { id }, data: { venueInsights: Prisma.DbNull } });
```

### Star ratings

UI shows 1–5 stars. The API and DB store 0–100. Convert on the client before sending:

```typescript
const apiValue = (stars / 5) * 100;
```

### JWT staleness

`session.user.role` comes from the JWT token, not the DB. Role changes require the user to re-login. Do not rely on live DB role for authorization — the token value is authoritative during a session.

### react-map-gl import

Always import from `react-map-gl/mapbox`, never from `react-map-gl` directly:

```typescript
import Map from 'react-map-gl/mapbox';
```

### Geofencing

`isInsideVenueRadius()` in `lib/geofence.ts` is **synchronous** — do not await it:

```typescript
const result = isInsideVenueRadius({ lat: guestLat, lon: guestLon }, venue);
if (!result.allowed) {
  return NextResponse.json(
    { error: `Morate biti u lokalu (${Math.round(result.distanceKm * 1000)}m od lokala)` },
    { status: 403 },
  );
}
```

### Red Alert indexing

`redAlert: true` job posts have a dedicated DB index (`@@index([redAlert])`). Filter by it directly — do not scan all job posts and filter in memory.

### Coordinate jitter

Venues get ~100m stable coordinate jitter derived from `venueId` hash (same logic as the RentCheck base). This is intentional for privacy — do not remove it.

### Rate limiting

Post-auth write actions use DB-backed rate limiting via `checkRateLimit`:

```typescript
import { checkRateLimit } from "@/lib/rate-limit";

const allowed = await checkRateLimit(userId, "post_review", 5);       // 5/hour
if (!allowed) return NextResponse.json({ error: "..." }, { status: 429 });
```

Current limits:
- `post_review` — 5 per hour
- `apply_job` — 10 per hour
- `post_invite` — 20 per hour

Pre-auth (login) uses the in-memory `rateLimit()` function — no userId available yet.

## Database Models (key ones)

- `User` — all roles in one table, `role` field discriminates
- `Venue` — lokal, owned by `VENUE_OWNER`
- `JobPost` — oglas za posao, belongs to `Venue`
- `JobApplication` — konobar applies to a `JobPost`
- `WaiterPassport` — one-to-one with `WAITER` User
- `EngagementRecord` — verified work history entry on the passport
- `Review` — tri tipa: `WAITER_TO_VENUE`, `VENUE_TO_WAITER`, `GUEST_TO_WAITER`
- `VenueZone` — map zone (hotspot) for analytics
- `Invite` — venue invite code for GOLD verification
- `RateLimit` — DB-backed rate limit counters (userId + action + hourly window)

## Trust Score

Bayesian scoring in `lib/trust-score.ts`. Score is 0–100.

**Venue dimensions:** atmosphere, organization, pay, tips, hygieneStandards, management

**Waiter dimensions:** punctuality, skill, guestCommunication, personalHygiene, teamwork, speed

`ID_VERIFIED` users get a ×1.2 weight multiplier on their reviews.

Score sync flow (run via `lib/sync-scores.ts`):
1. `publishDueReviews()` — moves PENDING reviews to PUBLISHED after the embargo window (2h for guest, 48h for others)
2. `syncVenueTrustScore(venueId)` — recalculates venue score
3. `syncPassportScore(waiterId)` — recalculates waiter passport score

The cron endpoint `POST /api/cron/publish-reviews` runs this flow on a schedule. Requires `Authorization: Bearer <CRON_SECRET>`.

## API Conventions

- All routes use Next.js Route Handlers (`route.ts`)
- Auth check: `getServerSession(authOptions)` from `lib/auth.ts`
- Rate limiting: `checkRateLimit(userId, action, max)` from `lib/rate-limit.ts`
- GeoJSON endpoints (`/api/venues/geojson`, `/api/jobs/geojson`) accept bounding box params: `swLat`, `swLng`, `neLat`, `neLng`
- `GUEST_TO_WAITER` reviews require `guestLatitude` and `guestLongitude` in the request body

## Review Lifecycle

```
POST /api/reviews → status: PENDING
  2h later (guest) / 48h later (venue/waiter) → publishDueReviews() → PUBLISHED
  if isHighFriction() (score ≥60 swing) → DISPUTED
```

## Engagement Completion Flow

```
PATCH /api/jobs/applications/[id] { status: COMPLETED }
  → creates EngagementRecord (verified: true)
  → WaiterPassport.totalEngagements++
  → syncPassportScore(waiterId) (fire-and-forget)
```

## Application Status State Machine

Venue owner transitions: `PENDING → SHORTLISTED → ACCEPTED → COMPLETED`  
Also allowed: `PENDING/SHORTLISTED/ACCEPTED → REJECTED`  
Waiter transitions: `PENDING/SHORTLISTED → WITHDRAWN`  
Any other transition returns 400.
