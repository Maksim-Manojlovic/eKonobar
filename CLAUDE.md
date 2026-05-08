# eKonobar — Claude Instructions

## Project

Next.js 15 (App Router) hospitality platform for Serbia. Waiters get a verified digital passport, venue owners post jobs and verify staff, headhunters search talent. Built with Prisma + PostgreSQL, NextAuth JWT, Mapbox, Bayesian trust scoring, geofenced reviews, shift scheduling, and a 3-layer notification system (web push + WhatsApp + SMS).

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

## ESLint

Config is in `eslint.config.mjs` (ESLint 9 flat config). Run with `npm run lint`. The CI job runs lint before tests — fix all errors before committing.

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

Guest reviews use 150m radius (venue.reviewRadiusKm). Shift clock-in uses a stricter 50m radius — pass `{ radiusOverrideKm: 0.05 }` as the third argument.

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

Guest review route uses `rateLimit(`guest_review:${ip}`, 3, 3_600_000)` — 3 per hour per IP.

### Image uploads

All image uploads go through `POST /api/upload` (multipart form-data). It validates MIME type (image/* only) and size (max 5 MB), then uploads to Cloudinary. The `type` field selects the preset:

| type | folder | transform |
|---|---|---|
| `avatar` | `ekonobar/avatars` | 400×400 face-crop |
| `venue-photo` | `ekonobar/venues` | 1200×800 fill |

The endpoint returns `{ url: string }`. Callers then persist the URL to the relevant model:

- Waiter avatar → `PUT /api/passport` with `{ profilePhoto: url }` (also syncs `User.image`)
- Venue photos → `PATCH /api/venues/[id]` with `{ images: string[] }` (max 8, owner-only)

Use the `ImageUpload` component from `components/ui/ImageUpload.tsx`. It has two modes: `shape="circle"` for avatars and `shape="rect"` (default) for drag-drop photo tiles. Pass `onUpload` which receives the URL and should call the persistence endpoint.

### Notifications

All in-app + multi-channel notifications go through `lib/notify.ts`:

```typescript
import { notify } from "@/lib/notify";

// Always fire-and-forget — never await in a request handler
notify(userId, "APPLICATION_RECEIVED", "Nova prijava", "Marko se prijavio...", "/dashboard/venue")
  .catch(console.error);
```

`notify()` always writes a `Notification` DB row, then dispatches:
1. **Web push** — if the user has a `PushSubscription` row (free, via VAPID)
2. **WhatsApp** — if `user.waOptIn && user.phone` and `WA_ACCESS_TOKEN` is set
3. **Infobip SMS** — if `user.smsOptIn && user.phone` and `INFOBIP_API_KEY` is set

Providers are no-ops when env vars are missing — safe in development.

`NotificationType` enum values: `APPLICATION_RECEIVED`, `APPLICATION_STATUS_CHANGED`, `SWAP_REQUESTED`, `SWAP_RESOLVED`, `SHIFT_CLAIMED`, `SHIFT_ASSIGNED`, `REVIEW_PUBLISHED`.

### Shift utilities

Use `lib/shift-utils.ts` for DateTime computation — never manually concatenate date + time strings:

```typescript
import { computeScheduledStart, computeScheduledEnd } from "@/lib/shift-utils";

const scheduledStart = computeScheduledStart("2025-06-15", "18:00"); // → Date
const scheduledEnd   = computeScheduledEnd("2025-06-15", "18:00", "02:00"); // → Date (+1 day, overnight)
```

`computeScheduledEnd` automatically detects overnight shifts (endTime < startTime) and adds 1 day.

### ShiftTemplate generation

`POST /api/shifts/templates/[id]/generate` is idempotent — it skips dates where a shift with the same `templateId + date` already exists. Max range: 90 days.

When `template.weekdaysOnly === true`, generation loops Mon–Fri (days 1–5) and ignores `template.dayOfWeek`. When `weekdaysOnly === false`, it matches only the specific `dayOfWeek`.

### Guest reviews (public, no auth)

`POST /api/reviews/guest` accepts unauthenticated submissions. `Review.authorId` is nullable — null means guest. Display as "Gost" in UI. `guestHandle` is an optional display name (max 50 chars). The route is rate-limited by IP and geofenced server-side.

The public venue info endpoint `GET /api/venues/[id]/public` returns venue + accepted waiters list — no auth required.

### Prisma client caching (dev)

The Prisma client is cached on `globalThis._prisma`. After every `db:push` that changes the schema, restart the dev server — HMR does not reload the cached client instance, which causes 500s on new models/fields.

## Database Models (key ones)

- `User` — all roles in one table, `role` field discriminates. Has `phone`, `smsOptIn`, `waOptIn` for notification prefs.
- `Venue` — lokal, owned by `VENUE_OWNER`
- `JobPost` — oglas za posao, belongs to `Venue`
- `JobApplication` — konobar applies to a `JobPost`
- `WaiterPassport` — one-to-one with `WAITER` User
- `EngagementRecord` — verified work history entry on the passport
- `Review` — three types: `WAITER_TO_VENUE`, `VENUE_TO_WAITER`, `GUEST_TO_WAITER`. `authorId` is nullable (null = guest).
- `VenueZone` — map zone (hotspot) for analytics
- `Invite` — venue invite code for GOLD verification
- `RateLimit` — DB-backed rate limit counters (userId + action + hourly window)
- `Shift` — a scheduled shift. Has `scheduledStart DateTime?`, `status ShiftStatus`, `requiredCount`, `templateId?`, `swapLocked`, `briefingNote`, `tipEstimate`.
- `ShiftAssignment` — explicit waiter-to-shift assignment (replaced implicit M2M). Has clock-in fields: `clockInAt`, `clockOutAt`, `clockInMethod`, `clockInLat`, `clockInLng`, `lateMinutes`, `earlyExitAt`.
- `ShiftSwapRequest` — swap request between two waiters. Status: `PENDING → ACCEPTED | REJECTED | CANCELLED`.
- `ShiftTemplate` — recurring shift pattern. Has `dayOfWeek Int?` (null when `weekdaysOnly=true`), `weekdaysOnly Boolean`, `metadata Json?` (`{ type, label, shift }`). Used for bulk generation.
- `Notification` — in-app notification record. Has `type NotificationType`, `title`, `body`, `link`, `read`, `pushSent`, `waSent`, `smsSent`.
- `PushSubscription` — browser Web Push subscription per user. Has `endpoint` (unique), `p256dh`, `auth`.

## Trust Score

Bayesian scoring in `lib/trust-score.ts`. Score is 0–100.

**Venue dimensions:** atmosphere, organization, pay, tips, hygieneStandards, management

**Waiter dimensions:** punctuality, skill, guestCommunication, personalHygiene, teamwork, speed

**Guest review dimensions:** friendliness, guestSpeed, attentiveness (these feed into the waiter's passport score)

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
- Guest review submissions go to `POST /api/reviews/guest` (no auth) — not the main `/api/reviews` route

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

## Shift System

### Clock-in flow

```
POST /api/shifts/[id]/clockin
  Body: { method: "GPS" | "QR" | "MANUAL", latitude?, longitude? }
  Window: scheduledStart - 15min to scheduledStart + 60min
  GPS: isInsideVenueRadius at 50m (radiusOverrideKm: 0.05)
  → records clockInAt, clockInMethod, lateMinutes on ShiftAssignment
```

### Clock-out flow

```
POST /api/shifts/[id]/clockout
  WAITER only. Must have clocked in (clockInAt set), not yet clocked out.
  → records clockOutAt
  → if now < scheduledEnd → also sets earlyExitAt (same timestamp)
  earlyExitAt is null when leaving on time or late
```

### Marketplace claim

```
POST /api/shifts/[id]/claim
  WAITER only. Shift must be OPEN, waiter not already assigned.
  → creates ShiftAssignment
  → shift status → ASSIGNED when filled (count >= requiredCount)
  → notifies venue owner
```

### Swap flow

```
POST /api/shifts/[id]/swap  { toWaiterId }
  → creates ShiftSwapRequest (status: PENDING)
  → shift status → PENDING_SWAP
  → notifies target waiter + venue owner

PATCH /api/shifts/swaps/[swapId]  { action: "ACCEPTED" | "REJECTED" }
  VENUE_OWNER only.
  ACCEPTED → atomic: delete fromAssignment, create toWaiter assignment, status → ASSIGNED
  REJECTED → status → ASSIGNED, notifies from-waiter
```

### Template generation

```
POST /api/shifts/templates/[id]/generate  { fromDate, toDate }
  Max range: 90 days
  weekdaysOnly=true → generates Mon-Fri
  weekdaysOnly=false → generates for template.dayOfWeek only
  Idempotent: skips dates where templateId+date already exists
  Returns: { created: N, skipped: M }
```

## Passport Share Links

```
POST /api/passport/share
  WAITER only.
  → generates cryptographic shareToken (24 random bytes, base64url)
  → sets shareTokenExpiry = now + 30 days
  → upserts on WaiterPassport
  → returns { shareToken, shareTokenExpiry }

GET /api/passport/public/[shareToken]
  No auth required.
  → returns { passport, engagements (last 20), reviews (last 30 PUBLISHED) }
  → 404 if token not found, 410 if expired
  → strips shareToken + shareTokenExpiry before responding
  Public URL: /passport/[shareToken]
```

## Sanitary Book Verification

```
POST /api/verification/sanitary  { fileUrl, expiryDate? }
  WAITER — submit or re-submit. Upserts with status: PENDING, clears prior review fields.

GET /api/verification/sanitary
  WAITER → own SanitaryBook record (or null)
  ADMIN  → all PENDING submissions ordered by uploadedAt asc

PATCH /api/verification/sanitary/[id]  { action: "approve" | "reject", rejectReason? }
  ADMIN only. Transaction:
  approve → SanitaryBook.status = APPROVED
          → WaiterPassport.sanitaryBookValid = true, sanitaryExpiry = expiryDate
  reject  → SanitaryBook.status = REJECTED, rejectReason set
          → WaiterPassport.sanitaryBookValid = false, sanitaryExpiry = null
```

## Invites

```
GET /api/invites
  VENUE_OWNER → their sent JOB_INVITEs (with recipient info)
  WAITER      → their received JOB_INVITEs (with sender + venue info)

POST /api/invites  { waiterId, jobPostId?, message? }
  VENUE_OWNER only. Rate-limited: post_invite 20/hour.
  Deduplicates: 409 if PENDING invite already exists for same sender+recipient.
  Expires in 7 days.

PATCH /api/invites/[id]  { status: "ACCEPTED" | "DECLINED" }
  WAITER only (recipient). Only transitions from PENDING.
  ACCEPTED → sets usedAt timestamp.
```

## Headhunter Saved Profiles

```
GET /api/headhunter/saved
  HEADHUNTER only. Returns saved profiles enriched with WaiterPassport data, ordered by savedAt desc.

POST /api/headhunter/saved  { waiterId, notes? }
  Upserts — re-saving updates notes.

DELETE /api/headhunter/saved  { waiterId }
  Removes the saved profile.
```

## Waiter Search

```
GET /api/waiters
  VENUE_OWNER or HEADHUNTER. Returns max 100 waiters ordered by passport score desc.
  Query params (all optional):
    available=true          → passport.currentlyAvailable = true
    minScore=N              → passport.score >= N
    sanitaryBook=true       → passport.sanitaryBookValid = true
    verificationTier=TIER   → UNVERIFIED | SILVER | GOLD | ID_VERIFIED
    skills=a,b,c            → passport.skills hasSome [a,b,c]
    languages=a,b           → passport.languages hasSome [a,b]
    minExperience=N         → passport.yearsExperience >= N
    search=text             → user.name contains text (case-insensitive)
```

## Zone Analytics

```
lib/analytics.ts — zone insight helpers (use dbRaw, not db):

getVenueZoneInsights(lat, lon) → VenueZoneInsights
  Finds all active VenueZone records the point falls within.
  Returns sorted by distance. INVESTMENT_ZONE_TYPES = FESTIVAL_ZONE | TRANSIT_HUB | DEVELOPMENT.
  hasZoneBadge = true when ≥1 investment zone matches.

refreshVenueZoneCache(venueId)
  Recomputes and stores result as venue.venueInsights (JSON field).
  Use Prisma.DbNull to clear if venue has no coordinates.

refreshAllVenueZoneCaches()
  Full rebuild for all non-deleted venues. O(venues × zones).

GET /api/admin/zones?type=ZONE_TYPE
  Public: active zones only. ADMIN: all zones.
  Optional ?type= filter by ZoneType enum.

POST /api/admin/zones  { name, zoneType, geoJson, centerLat, centerLng, radiusKm?, projectedGrowthPercent?, operatorTip?, description? }
  ADMIN only. ZoneType values: FESTIVAL_ZONE | TRANSIT_HUB | DEVELOPMENT | RESIDENTIAL | COMMERCIAL | ...
```

## Market Insights

```
GET /api/insights/market
  Requires auth (any role).
  Returns aggregate stats across all ACTIVE job posts:
    { openPositions, redAlertCount, avgSalaryMin, avgSalaryMax, topMunicipalities (top 3) }
```

## Admin Routes

```
GET  /api/admin/reviews           → DISPUTED reviews (last 100, newest first). ADMIN only.
PATCH /api/admin/reviews/[id]  { action: "publish" | "remove" }
  publish → status PUBLISHED, sets publishedAt, fires score sync (fire-and-forget)
  remove  → status REMOVED

DELETE /api/admin/venues/[id]
  GDPR hard-delete via dbRaw. Cascades to all related records (jobPosts, reviews,
  engagementRecords, shifts, venueTrustScore). Works on soft-deleted venues too.
```

## Notification System

### Dispatch flow

```
notify(userId, type, title, body, link?)
  → 1. db.notification.create (always)
  → 2. web push to all PushSubscription rows (VAPID, free)
      expired subs (410/404) auto-deleted
  → 3. WhatsApp template msg if user.waOptIn && user.phone (opt-in)
  → 4. Infobip SMS if user.smsOptIn && user.phone (premium opt-in)
```

### VAPID setup (one-time)

```bash
npx web-push generate-vapid-keys
# Add to .env:
# VAPID_PUBLIC_KEY=...
# VAPID_PRIVATE_KEY=...
# NEXT_PUBLIC_VAPID_KEY=...  ← same as VAPID_PUBLIC_KEY, browser-exposed
```

### WhatsApp templates

Template name is set via `WA_TEMPLATE_NAME` env var (default: `ekonobar_notification`). The template must be approved in Meta Business Manager before use. Template parameters: `[title, body]`.

### SMS format

Infobip messages are truncated to 160 chars: `"${title}: ${body} | ekonobar.rs"`.
