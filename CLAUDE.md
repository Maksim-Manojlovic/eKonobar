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
npm test                 # run all tests — unit + integration (requires DATABASE_URL)
npm run test:unit        # unit tests only (no DB required)
npm run test:integration # integration tests only (requires real PostgreSQL)
npm run test:watch       # run unit tests in watch mode
```

## Redis

Optional in development (all features degrade gracefully when `REDIS_URL` is not set). Required in production for distributed locks and cross-instance caches.

**Local dev:** `docker compose up redis` (service defined in `docker-compose.yml`), then add `REDIS_URL=redis://localhost:6379` to `.env`.

### Client

`lib/core/redis.ts` — exports `redis: Redis | null`. Always `null` when `REDIS_URL` is unset. All Redis-dependent code guards on `if (redis)` and falls back to the DB path. This means unit tests work without Redis configured.

`lib/core/redis-lock.ts` — `acquireLock(key, ttlMs)` / `releaseLock(key, token)`. Returns a discriminated `LockResult` (`acquired: true | false`). On `reason: "contended"` → return 409. On `reason: "unavailable"` → fail-open with `logger.warn` (lock is a correctness layer, not availability layer — shift claim is the exception).

### Cache key taxonomy

| Prefix | Module | TTL | Busted by |
|---|---|---|---|
| `token:rev:{userId}` | `lib/auth/revocation.ts` | 5s (ADMIN) / 60s | next request after TTL |
| `rl:{key}:{bucket}` | `lib/core/rate-limit.ts` | `windowMs + 10s` | TTL only |
| `rl:auth:{userId}:{action}:{bucket}` | `lib/core/rate-limit.ts` | `windowMs + 10s` | TTL only |
| `notif:cache:{userId}` | `api/notifications/route.ts` | 60s | `notify()`, mark-read PATCH |
| `notif:dispatch:prefs:{userId}` | `lib/notifications/notify.ts` | 300s | notification-prefs PATCH, push subscribe/unsubscribe, tier change |
| `cache:admin:stats` | `api/admin/stats/route.ts` | 60s | TTL only |
| `passport:tier:{userId}` | `lib/passport/tier-cache.ts` | min(time-to-expiry, 3600s) | `bustTierCache()` — Monri callback, subscribe route |
| `waiter:search:gen` | `api/waiters/route.ts` | no TTL (counter) | `INCR` after every `syncPassportScore` |
| `search:waiters:{gen}:{hash}` | `api/waiters/route.ts` | 120s | counter change (old keys expire via TTL) |
| `score:sync:waiter:{waiterId}` | `lib/notifications/side-effects.ts` | 5s | TTL only — cooldown guard, prevents concurrent re-syncs |
| `score:sync:venue:{venueId}` | `lib/notifications/side-effects.ts` | 5s | TTL only — cooldown guard, prevents concurrent re-syncs |
| `shift:claim:lock:{shiftId}` | `api/shifts/[id]/claim/route.ts` | 5s | `releaseLock` in `finally` |
| `cron:renew-subscriptions:running` | `api/cron/renew-subscriptions` | 300s | TTL only |
| `renewal:lock:{userId}` | `api/cron/renew-subscriptions` | 3600s | TTL only |
| `analytics:venue:{venueId}:{period}` | `api/venues/[id]/waiter-analytics` | 300s | TTL only |

### Cache bust functions

- `bustTierCache(userId)` — `lib/passport/tier-cache.ts`
- `bustNotifyPrefsCache(userId)` — `lib/notifications/notify.ts`

Call both when a user's passport tier changes (payment, cancellation). Call `bustNotifyPrefsCache` alone when contact preferences or push subscriptions change.

### Testing Redis paths

Unit tests mock `@/lib/core/redis` with a fake client:

```typescript
const mockRedis = { get: vi.fn(), set: vi.fn(), del: vi.fn(), incr: vi.fn() };
vi.mock("@/lib/core/redis", () => ({ redis: mockRedis }));
```

Tests for the no-Redis fallback path do not mock `@/lib/core/redis` — the module returns `null` naturally when `REDIS_URL` is unset, so the DB mock path activates automatically.

**Caveat — this only holds when `REDIS_URL` is unset.** A dev machine with `REDIS_URL` in `.env` runs unit tests against **live Redis**, and cache reads then leak across test files: a test seeding `passport:tier:waiter-1 = "FREE"` makes a later PRO-tier test in another file resolve FREE, failing only in full-suite runs. Any test whose subject reads a Redis-cached value (tier, rate limit, search gen) must pin the path explicitly:

```typescript
vi.mock("@/lib/core/redis", () => ({ redis: null }));
```

## ESLint

Config is in `eslint.config.mjs` (ESLint 9 flat config). Run with `npm run lint`. The CI job runs lint before tests — fix all errors before committing.

## Tests

Three patterns in use:

- **Pure function tests** (co-located `__tests__/` in each `src/lib/` subdirectory) — no mocking; test trust-score and geofence helpers directly.
- **Route handler unit tests** (`*.test.ts`) — mock `next-auth`, `@/lib/core/db`, and `@/lib/notifications/side-effects`; call the exported handler directly; assert on `Response.status` and mock call args. Mock at module level with `vi.mock(...)` before imports, `vi.clearAllMocks()` in `beforeEach`. Routes that use `notify` directly (not `fireSideEffects`) still need `await new Promise(r => setTimeout(r, 0))` to flush fire-and-forget calls.
- **Integration tests** (`*.integration.test.ts`) — real PostgreSQL, no DB mocking. Use `resetDb()` in `beforeEach`. Mock only: `next-auth` + `@/lib/auth/config` (session), `@/lib/notifications/side-effects` (fire-and-forget), and pure crypto helpers already covered by unit tests. Seed helpers: `seedUser`, `seedVenue`, `seedPassport` from `@/tests/integration/db-reset`. Route handlers typed as `(req, ctx)` — always pass a second arg: `const CTX = { params: Promise.resolve({}) }` for non-dynamic routes, or `{ params: Promise.resolve({ id }) }` for `[id]` routes.

## Critical Patterns

### db vs dbRaw

`db` (from `lib/core/db.ts`) applies a global soft-delete filter — it never returns rows where `deletedAt IS NOT NULL`. Use it everywhere except:
- `lib/scoring/sync.ts` — needs all rows for score recalculation
- Admin routes — need to see and restore deleted records
- `lib/core/rate-limit.ts` — uses `dbRaw` directly

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

`isInsideVenueRadius()` in `lib/geo/geofence.ts` is **synchronous** — do not await it:

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

**Red Alert early access for PRO/PRO_PLUS waiters:** FREE tier waiters see — and may apply to — Red Alert posts only after a 30-minute delay.

All enforcement goes through `lib/passport/red-alert.ts`. **Never inline the cutoff or the OR clause in a route.** It previously lived inline in `GET /api/jobs` only, which left `GET /api/jobs/geojson` and `POST /api/jobs/applications` serving the full undelayed set to anyone.

```typescript
import { getRedAlertCutoff, redAlertVisibilityFilter, isRedAlertEmbargoed } from "@/lib/passport/red-alert";

// Read surfaces — compose under AND, never as a bare `OR` key:
const redAlertCutoff = await getRedAlertCutoff(session);
where: { status: "ACTIVE", AND: redAlertVisibilityFilter(redAlertCutoff) }

// Write surfaces — block the action, not just the listing:
if (isRedAlertEmbargoed(post, redAlertCutoff)) return NextResponse.json({ error: "..." }, { status: 403 });
```

`getRedAlertCutoff(session)` returns a `Date` (delay applies) or `undefined` (full set):

| Caller | Cutoff |
|---|---|
| PRO / PRO_PLUS waiter, active sub | `undefined` |
| FREE waiter, or expired sub | `now - RED_ALERT_DELAY_MS` |
| **Unauthenticated** | `now - RED_ALERT_DELAY_MS` |
| VENUE_OWNER / HEADHUNTER / ADMIN | `undefined` (not the audience for the gate) |

Unauthenticated callers are gated deliberately. Leaving them undelayed makes every other gate pointless — a FREE waiter just signs out, or reads the public map GeoJSON, and gets the same posts instantly.

**Gate writes, not just reads.** What PRO sells is *applying first*. `POST /api/jobs/applications` returns 403 for an embargoed Red Alert; without it, anyone who learns a post id by any means converts it into an early application regardless of the read gates.

**Never share a cache across entitlement.** `/api/jobs/geojson` sends `public, s-maxage=15` for the delayed set (identical for every unauthenticated/FREE caller) but `private, no-store` when serving the undelayed PRO set — one public hit there would hand every FREE waiter the early access they didn't buy.

**Composing `OR` filters:** `redAlertVisibilityFilter` returns an *array* for spreading into `AND`, not a bare `{ OR }`. Spreading two `{ OR: [...] }` objects into one Prisma where-object silently drops the first — duplicate JS keys overwrite. This bug shipped in `GET /api/jobs`, where a FREE waiter's `?search=` was discarded.

### Coordinate jitter

`stableJitter(id)` in `lib/geo/bbox.ts` — venues get ~100m stable coordinate jitter derived from a `venueId` hash (same logic as the RentCheck base). Intentional for privacy — published coordinates mark the zone, never the exact address. Do not remove it, and do not re-inline a copy in a route (it was duplicated across both geojson routes).

### Map GeoJSON endpoints

`/api/venues/geojson` and `/api/jobs/geojson` back the map. Both take a viewport bbox (`swLat`, `swLng`, `neLat`, `neLng`) plus filters, and both cap the result (`MAX_FEATURES` — 200 venues / 300 jobs).

**Filter in the query, never on the response.** The cap makes client-side `.filter()` silently wrong: it filters an already-truncated page, so a chip like "Red Alert" can show 3 of 40 and look like the whole truth. Add a param to the route's `QuerySchema` and let the DB filter. `MapSearch` sends its filter state as query params and refetches on change — it does not post-filter.

**bbox validation:** `BBoxSchema` from `lib/geo/bbox.ts`, via `parseQuery`. Never hand-roll `parseFloat` + `isNaN`. It rejects inverted boxes (`swLat >= neLat`), out-of-range coordinates, and — importantly — empty params: `z.coerce.number()` alone maps `""` → `0`, which silently widens a viewport to the equator. Coordinates are deliberately unclamped: coverage follows the data, so a new city needs no endpoint change.

`parseQuery` is typed `ZodType<Out, _, In>`, so schemas may parse strings into numbers/enums (`z.string().min(1).pipe(z.coerce.number())`).

**Beograd today, Serbia later:** `lib/geo/cities.ts` holds the seeded cities and `DEFAULT_CITY` (the map's initial viewport). Only Belgrade is seeded. The endpoints are already city-agnostic — they filter by bbox, not by city — so adding Novi Sad is one `CITIES` entry plus a picker. Do not hardcode city coordinates in a component.

### Rate limiting

Post-auth write actions use DB-backed rate limiting via `checkRateLimit`:

```typescript
import { checkRateLimit } from "@/lib/core/rate-limit";

const allowed = await checkRateLimit(userId, "post_review", 5);       // 5/hour
if (!allowed) return NextResponse.json({ error: "..." }, { status: 429 });
```

Current limits:
- `post_review` — 5 per hour
- `apply_job` — 10 per hour
- `post_invite` — 20 per hour

Pre-auth routes use `rateLimit(key, max, windowMs)` from `lib/core/rate-limit.ts`, which is backed by the `AnonRateLimit` table (no FK — works before a User row exists, survives server restarts, safe across multiple instances). Key format: `"<action>:<value>"`.

Login applies **two independent limits** in `authorize()`:
- `login:ip:{ip}` — 20 attempts / 15 min (broad guard, stops distributed stuffing)
- `login:email:{email}` — 5 attempts / 15 min (tight guard, stops targeted brute-force)

Guest review route uses `rateLimit(`guest_review:${ip}`, 3, 3_600_000)` — 3 per hour per IP.

Forgot-password route uses `rateLimit(`forgot:${ip}`, 3, 15 * 60 * 1000)` — 3 per 15 min per IP (silent 200).

**IP extraction:** All IP-based rate limits use `getClientIp(req)` / `getClientIpFromHeaders(headers)` from `lib/core/ip.ts` — never read `X-Forwarded-For` directly. `X-Forwarded-For` is only trusted when `TRUST_PROXY=1` is set (production, behind a known proxy). Without it, `req.ip` is used (Vercel/edge), falling back to `"unknown"`. Set `TRUST_PROXY=1` in production when behind nginx, Railway, fly.io, etc.

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

All in-app + multi-channel notifications go through `lib/notifications/notify.ts`:

```typescript
import { notify } from "@/lib/notifications/notify";

// Always fire-and-forget — never await in a request handler
notify(userId, "APPLICATION_RECEIVED", "Nova prijava", "Marko se prijavio...", "/dashboard/venue")
  .catch(console.error);
```

`notify()` always writes a `Notification` DB row, then dispatches:
1. **Web push** — if the user has a `PushSubscription` row (free, via VAPID)
2. **WhatsApp** — if `user.waOptIn && user.phone`, `WA_ACCESS_TOKEN` is set, **and the recipient has an active PRO or PRO_PLUS passport tier**
3. **Infobip SMS** — if `user.smsOptIn && user.phone`, `INFOBIP_API_KEY` is set, **and the recipient has an active PRO_PLUS passport tier**

Providers are no-ops when env vars are missing — safe in development.

**Internal architecture:** Channel dispatchers (`dispatchPush`, `dispatchWhatsApp`, `dispatchSms`) perform the network send only and return a boolean. The coordinator collects all results, then does a single `await db.notification.update` with all status flags (`pushSent`, `waSent`, `smsSent`) and retry counters (`waRetries`, `smsRetries`) in one batched write. No fire-and-forget DB writes inside dispatchers.

**Tier resolution:** `notify()` always fetches `waiterPassport` as part of the initial `user.findUnique` select. Tier is computed in-process from that data — no second DB query needed. Do not pass a `tierHint` parameter (it was removed — it provided no actual DB savings).

**Tier gating logic in `notify()`:** `notify` queries `waiterPassport.passportTier` and `subscriptionExpiresAt` for the recipient. If `subscriptionExpiresAt` is in the past, the tier is treated as FREE at runtime. WhatsApp requires `isPro` (PRO or PRO_PLUS active), SMS requires `isProPlus` (PRO_PLUS active). Venue owners and other non-waiter roles always receive all channels (tier gating only applies to WAITER recipients).

`NotificationType` enum values: `APPLICATION_RECEIVED`, `APPLICATION_STATUS_CHANGED`, `SWAP_REQUESTED`, `SWAP_RESOLVED`, `SHIFT_CLAIMED`, `SHIFT_ASSIGNED`, `REVIEW_RECEIVED`, `REVIEW_PUBLISHED`, `CLOCKIN_APPROVAL_REQUESTED`, `CLOCKIN_RESOLVED`, `RED_ALERT_POSTED`.

- `REVIEW_RECEIVED` — fires to venue owner when any review is submitted (WAITER_TO_VENUE, GUEST_TO_VENUE, GUEST_TO_WAITER)
- `RED_ALERT_POSTED` — fires to matching waiters when a Red Alert job is posted (see Red Alert broadcast below). When adding a new `NotificationType`, also add its icon to `TYPE_ICONS` (`NotificationBell.tsx`) and, if it deserves its own filter chip, an entry to `FILTER_MAP`/`FILTER_GROUPS` in `NotificationsSection.tsx`.

### Red Alert broadcast (reverse discovery)

`lib/notifications/red-alert-broadcast.ts` — `broadcastRedAlert({ jobPostId, jobTitle, venueName, municipality })`. `POST /api/jobs` calls it **fire-and-forget** when a created post has `redAlert: true`; a broadcast failure must never fail the post creation.

Recipients: available WAITERs whose `workMunicipalities` includes the venue's municipality, **PRO/PRO_PLUS only**, capped at 50. FREE waiters are excluded on purpose — Red Alert early access is the paid feature, and web push reaches every tier, so pushing to FREE here would leak the early access the `GET /api/jobs` delay and the apply gate enforce. Tier is filtered at the DB by `passportTier IN (PRO, PRO_PLUS)`, then re-checked in-process with `isPro` so an expired subscription (stored tier still PRO, effectively FREE) is dropped. **This matching only works when the venue's municipality is canonical** (`normalizeMunicipality` on write + the backfill) — a free-text venue municipality won't `has`-match a canonical `workMunicipalities`.

### NotificationBell

`components/ui/NotificationBell.tsx` — bell icon + dropdown/sheet UI. Props:

```typescript
<NotificationBell
  dashboardPath="/venue"          // fallback nav when onViewAll is not provided
  onViewAll={() => setSection("notifications")}   // switch to in-page section
  onUnreadChange={(count) => setNotifUnread(count)} // sync nav badge count
/>
```

- Desktop: `w-80` absolute dropdown (max-h 480px)
- Mobile: `fixed inset-0` bottom sheet with `sheet-up` animation, `82dvh` max-height, safe-area-inset-bottom footer padding, body scroll lock while open
- Polls every 30s; marks all read on open if unread > 0
- Exports `NotificationItem` type and `TYPE_ICONS` map — imported by `NotificationsSection`

### NotificationsSection

`components/ui/NotificationsSection.tsx` — full-page notification feed. Renders inside the dashboard when `section === "notifications"`:

- Filter chips: Sve / Prijave / Smene / Zamene / Recenzije (maps to `NotificationType` subsets)
- Notifications grouped by day: "Danas" / "Juče" / weekday + date (Serbian locale)
- Click any row → marks as read + navigates to `n.link`
- "Označi sve pročitanim" button when unread > 0
- Per-item read via `PATCH /api/notifications { ids: [id] }` (optimistic UI, then confirm)

### Shared formatting & display utilities

`lib/formatting/utils.ts` — pure formatting helpers, zero imports from other project modules. Safe to import from any layer:

- `getInitials(name)` — up to 2 uppercase initials, or `"?"` when blank
- `formatSalary({ salaryMin, salaryMax, engagementType })` — Serbian locale salary range; `"/mes"` for FULL_TIME, `"/sm"` otherwise; falls back to `"Po dogovoru"`

`lib/formatting/display-maps.ts` — **single source of truth** for Tailwind badge classes and human-readable labels. Never define `*_COLORS` or `*_LABELS` maps inline in a page; import from here:

- `VERIFICATION_TIER_COLORS` — per verification tier (UNVERIFIED → ID_VERIFIED)
- `PASSPORT_TIER_COLORS` — per passport tier, dark-bg variant
- `APPLICATION_STATUS_COLORS`, `APPLICATION_STATUS_LABELS` — per application status
- `INVITE_STATUS_COLORS`, `INVITE_STATUS_LABELS` — per invite status
- `DIRECTION_LABELS` — all 4 review directions (WAITER_TO_VENUE, VENUE_TO_WAITER, GUEST_TO_WAITER, GUEST_TO_VENUE)
- `ROLE_LABELS` — all 4 user roles (WAITER, VENUE_OWNER, HEADHUNTER, ADMIN)

### Side effects

`lib/notifications/side-effects.ts` — `fireSideEffects(opts)` — schedules score syncs and notifications as fire-and-forget. Use instead of calling `notify()` and `syncPassportScore()`/`syncVenueTrustScore()` directly in route handlers:

```typescript
import { fireSideEffects } from "@/lib/notifications/side-effects";

fireSideEffects({
  syncVenueId:   venueId,       // optional
  syncWaiterId:  waiterId,      // optional
  notifications: [{ userId, type, title, body, link }],  // optional
});
// Returns void — never await.
```

Tests mock as `vi.fn()` — no `await new Promise(r => setTimeout(r, 0))` timer hacks needed.

### Shift authorization

`lib/shifts/auth.ts` — shift management access helpers. Use in shift route handlers instead of repeating the owner/head-waiter check inline:

- `canManageShifts(userId, role, venue)` → `boolean` — true if VENUE_OWNER owns the venue or WAITER is the venue's `headWaiterId`
- `getManagedShift(shiftId, userId, role)` → shift with venue + assignments, or `null` if not found / not authorized
- `getManagedTemplate(templateId, userId, role)` → same for shift templates

### Audit logging

`lib/core/audit.ts` — `logAudit(actorId, action, targetId, targetType, meta?)` — fire-and-forget write to `AuditLog` table. Use for sensitive admin actions (role changes, hard deletes):

```typescript
import { logAudit } from "@/lib/core/audit";
logAudit(session.user.id, "USER_ROLE_CHANGE", targetId, "User", { from: old, to: newRole });
```

### Logging

`lib/core/logger.ts` — pino logger. Dev: pretty-print. Production: JSON. Import as:

```typescript
import logger from "@/lib/core/logger";
logger.error({ err }, "something failed");
```

Use `logger` in lib modules and in cron/admin route fire-and-forget callbacks. The pattern is:

```typescript
someAsyncOp().catch(err => logger.error({ err, contextId }, "op failed in route-name"));
```

Never swallow a server-side fire-and-forget with bare `.catch(() => {})`. Always log: `logger.warn` for best-effort ops where failure is non-fatal (Redis cache writes/busts, metric counters), `logger.error` for load-bearing ops where a silent failure leaves bad state (e.g. a payment status update). Bare empty catches are acceptable only for genuinely cosmetic client-side UX (clipboard copy, background poll refresh).

`console.error` is acceptable only in truly ephemeral callbacks where the context is obvious (e.g. simple client-side fetch handlers). Do **not** use `console.error` in lib modules or cron routes — pino outputs structured JSON in production; `console.error` bypasses it and produces unstructured stderr with no request context. This applies to boot-time code too: `lib/core/env.ts` env-var validation warnings go through `logger.warn`, not `console.warn` (`logger.ts` imports only `pino`, so importing it at module-load is cycle-free).

### Shift utilities

Use `lib/shifts/utils.ts` for DateTime computation — never manually concatenate date + time strings:

```typescript
import { computeScheduledStart, computeScheduledEnd } from "@/lib/shifts/utils";

const scheduledStart = computeScheduledStart("2025-06-15", "18:00"); // → Date
const scheduledEnd   = computeScheduledEnd("2025-06-15", "18:00", "02:00"); // → Date (+1 day, overnight)
```

`computeScheduledEnd` automatically detects overnight shifts (endTime < startTime) and adds 1 day.

### ShiftTemplate generation

`POST /api/shifts/templates/[id]/generate` is idempotent — it skips dates where a shift with the same `templateId + date` already exists. Max range: 90 days.

When `template.weekdaysOnly === true`, generation loops Mon–Fri (days 1–5) and ignores `template.dayOfWeek`. When `weekdaysOnly === false`, it matches only the specific `dayOfWeek`.

### Guest reviews (public, no auth)

`POST /api/reviews/guest` accepts unauthenticated submissions. Supports two directions via the `direction` field (default: `"GUEST_TO_WAITER"`):

- `GUEST_TO_WAITER` — requires `subjectId` (waiter); stores `ratingFriendliness`, `ratingGuestSpeed`, `ratingAttentiveness`; fires `syncPassportScore`
- `GUEST_TO_VENUE` — no `subjectId`; stores `ratingAtmosphere`, `ratingOrganization`, `ratingHygieneWork`; fires `syncVenueTrustScore`

`Review.authorId` is nullable — null means guest. Display as "Gost" in UI. `guestHandle` is an optional display name (max 50 chars). The route is rate-limited by IP (3/hour) and geofenced server-side (150m). After creation, `REVIEW_RECEIVED` is sent to the venue owner.

The `/review/[venueId]` public page (`src/app/(public)/review/[venueId]/page.tsx`) presents a 3-choice flow: "Oceni restoran" (GUEST_TO_VENUE), "Oceni konobara" (GUEST_TO_WAITER), "Oceni oba" (both — two sequential POSTs sharing the same geolocation coords). Step type: `"loading" | "error404" | "choose" | "venue" | "waiter" | "both-venue" | "both-waiter" | "success"`.

The public venue info endpoint `GET /api/venues/[id]/public` returns venue + accepted waiters list — no auth required.

### Dashboard architecture

Each dashboard is split across several co-located files. Do not put shared helpers or type definitions back into `page.tsx`.

**Venue dashboard** (`src/app/(dashboard)/venue/`):
- `page.tsx` — root client component, session + section state only; no business logic
- `venue-types.ts` — type declarations only: `Section`, `AppFilter`, and all API response shapes. No runtime values.
- `venue-constants.ts` — runtime display constants: `SECTION_TITLES`. Imports types from `venue-types.ts`.
- `venue-helpers.tsx` — shared UI: `PostStatusBadge`, `AppStatusBadge`, `TierBadge`, `PassportTierBadge`, `ScorePill`, `Sk` (re-exported from `components/ui/Sk`), and all `*Skeleton` loader components
- Section components: `VenueJobsSection`, `VenueSmeneSection`, `VenueDiscoverSection`, `VenueReviewsSection`, `ProfileSection`, `VenueSmeneModals`

**Waiter dashboard** (`src/app/(dashboard)/waiter/`):
- `page.tsx` — root client component
- `waiter-types.ts` — type declarations only: `Section`, `ShiftAssignment`, `WaiterShift`, and all API response shapes. No runtime values.
- `waiter-constants.ts` — runtime display constants: `TIER_BADGE`, `NEXT_TIER`, `DIRECTION_LABELS`, `BADGE_META`, `BADGE_PROGRESS` (named progress functions + map), `VENUE_TYPE_OPTIONS`, `SCORE_DIMS`, `SECTION_TITLES`. Imports types from `waiter-types.ts`.
- `waiter-helpers.tsx` — shared UI: `StatusBadge`, `ShiftStatusBadge`, `Sk`, and all `*Skeleton` loaders
- Section components: `WaiterOverviewSection`, `WaiterJobsSection`, `WaiterSmeneSection`, `WaiterPassportSection`, `WaiterInvitesSection`, `WaiterReviewsSection`
- `useNotifPrefs.ts` — co-located hook owning the notification-preferences concern (phone / WhatsApp / SMS opt-in + web-push subscribe toggle + their load/save). Extracted out of `WaiterPassportSection` to shrink its state surface (CQ-G). Section components with many self-contained concerns should extract them into co-located hooks like this rather than accumulating `useState` in the component body.
- `useSanitaryBook.ts` — co-located hook owning the sanitary-book verification concern (current record load + upload/expiry draft + submit + replace). Also extracted from `WaiterPassportSection` (CQ-G). Together with `useNotifPrefs` this cut the component from 26 → 14 `useState`.

**Admin dashboard** (`src/app/(dashboard)/admin/`):
- `admin-types.ts` — `PlatformStats`, `ActivityEvent`, `HealthData`, `LeaderboardData`, and all other admin-scoped types
- `admin-helpers.tsx` — `DashboardSkeleton`, `BigStat`, `MiniStat`, `SectionCard`, `timeAgo` — **always import from here, never redefine**
- Sub-pages: `users/`, `venues/`, `analytics/zones/`, `moderation/`, `verifications/`

### Code conventions

**Inline UI micro-components:** Never define `Initials`, `PassportTierBadge`, `ScorePill`, or similar inside a page file. For venue/headhunter contexts import from `venue-helpers.tsx`. For cross-dashboard reuse, promote to `components/ui/`.

**`timeAgo()`:** Defined once in `lib/formatting/utils.ts`. Import directly from there. Admin pages use the re-export in `admin-helpers.tsx` (intentional — keeps admin imports consistent). Do not write a new local definition.

**Display maps:** Always import `*_COLORS` and `*_LABELS` constants from `lib/formatting/display-maps.ts`. Do not define them inline in a page.

**Page-level types:** Define API response shapes in the co-located `*-types.ts` file (e.g., `venue-types.ts`, `waiter-types.ts`, `admin-types.ts`), not inline in the page component. `*-types.ts` must contain **type/interface declarations only** — no runtime values. Co-locate runtime display constants (label maps, badge configs, section titles) in a sibling `*-constants.ts` file that imports from the types file. See `waiter-constants.ts` for the pattern.

**Fire-and-forget side effects:** Use `fireSideEffects()` from `lib/notifications/side-effects.ts` instead of calling `notify()` and score-sync functions directly. Keeps route handlers clean and makes tests trivial to write (mock the whole module as `vi.fn()`).

**Grouped form state:** A form/filter component with many fields must hold them in **one** typed object + a `setField(k, v)` updater — never one `useState` per field (that scatters state, invites desync, and resists validation). Pattern: `ReviewForm` (guest review, CQ-N), `JobPostForm` (`jobs/new`, CQ-Q), `WaiterFilters` (`useWaiterSearch`, CQ-P), the grouped `form` object in `VenueSmeneModals`. Keep genuine control state (loading/saving/error) as separate `useState`.

### Dark dashboard theme

The venue-owner, waiter, headhunter, and admin dashboards all share the same dark visual theme (`src/app/(dashboard)/venue/page.tsx`, `waiter/page.tsx`, `headhunter/page.tsx`, `admin/page.tsx`, `admin/users/page.tsx`):

- **Background:** `#120a00` with an orange-brown grid via `background-image: linear-gradient(...)` inline style on the outer div
- **Mouse spotlight:** `useRef<HTMLDivElement>(null)` pointing at a `position: fixed; inset: 0; z-index: 1; pointer-events: none` div. `onMouseMove` on the outer div updates its `style.background` directly (no state, no re-renders):
  ```typescript
  spotlightRef.current.style.background =
    `radial-gradient(600px circle at ${x}px ${y}px, rgba(249,115,22,0.07), transparent 70%)`;
  ```
- **Sidebar / mobile drawer:** `#0e0700` + same grid, `border-white/10`. Apply `dark-sidebar` class to the `<aside>` element — this enables the CSS overrides for `.nav-item` without affecting light-mode pages.
- **`.dark-sidebar` CSS class** (in `globals.css`):
  ```css
  .dark-sidebar .nav-item              { color: rgba(255,255,255,0.55); }
  .dark-sidebar .nav-item:hover        { background: rgba(249,115,22,0.12); color: #fb923c; }
  .dark-sidebar .nav-item.active       { background: rgba(249,115,22,0.20); color: #fb923c; }
  ```
- **z-index layering:** spotlight at `z-1` (fixed), sidebar + main content at `z-2` (relative) so spotlight renders behind interactive elements.
- **Headings on dark background:** use `text-white`. Headings inside white `dash-card`s stay `text-neutral-900`.

### Skeleton loaders

All dashboards use content-shaped skeleton loaders instead of spinners.

**Shared component:** `components/ui/Sk.tsx` — never redefine `Sk` locally:

```typescript
import { Sk } from "@/components/ui/Sk";

// light (venue / waiter dash-card context):
<Sk className="h-8 w-40" />

// dark (admin dark dashboard):
<Sk dark className="h-8 w-40" />
```

- `dark=false` → `bg-neutral-200 rounded-lg` (venue / waiter dashboards)
- `dark=true`  → `bg-white/10 rounded-xl`  (admin dashboard)

`venue-helpers.tsx` and `waiter-helpers.tsx` re-export `Sk` from the shared component (light variant). `admin-helpers.tsx` exports a dark-pinned wrapper so existing admin consumers need no change.

Each section has a dedicated `*Skeleton` function that mirrors the real layout — same grid columns, same card heights, no generic spinner. Wire via `if (loading) return <SectionNameSkeleton />;` at the top of each section component.

### Prisma client caching (dev)

The Prisma client is cached on `globalThis._prisma`. After every `db:push` that changes the schema, restart the dev server — HMR does not reload the cached client instance, which causes 500s on new models/fields.

## Database Models (key ones)

- `User` — all roles in one table, `role` field discriminates. Has `phone`, `smsOptIn`, `waOptIn` for notification prefs. `tourCompleted Boolean @default(false)` — set true after first-login dashboard tour closes; carried in JWT so no extra DB call at runtime.
- `Venue` — lokal, owned by `VENUE_OWNER`. Has `logo String?` — displayed as circle avatar in sidebar and top bar instead of initials when set.
- `JobPost` — oglas za posao, belongs to `Venue`
- `JobApplication` — konobar applies to a `JobPost`
- `WaiterPassport` — one-to-one with `WAITER` User
- `EngagementRecord` — verified work history entry on the passport
- `Review` — four directions: `WAITER_TO_VENUE`, `VENUE_TO_WAITER`, `GUEST_TO_WAITER`, `GUEST_TO_VENUE`. `authorId` is nullable (null = guest).
- `PassportTier` enum — `FREE | PRO | PRO_PLUS`. Used on `WaiterPassport.passportTier` and `PassportPayment.tier`.
- `VenueZone` — map zone (hotspot) for analytics
- `Invite` — venue invite code for GOLD verification
- `RateLimit` — DB-backed rate limit counters (userId + action + hourly window)
- `AnonRateLimit` — pre-auth rate limit counters (no FK; composite PK on `[key, windowStart]`). Used for `login:ip:*`, `login:email:*`, `forgot:*`, `guest_review:*`
- `Shift` — a scheduled shift. Has `scheduledStart DateTime?`, `status ShiftStatus`, `requiredCount`, `templateId?`, `swapLocked`, `briefingNote`, `tipEstimate`.
- `ShiftAssignment` — explicit waiter-to-shift assignment (replaced implicit M2M). Has clock-in fields: `clockInAt`, `clockOutAt`, `clockInMethod` (GPS | GPS_GRACE | QR | MANUAL), `clockInLat`, `clockInLng`, `lateMinutes`, `earlyExitAt`, `pendingClockIn` (awaiting manager approval).
- `ShiftSwapRequest` — swap request between two waiters. Status: `PENDING → ACCEPTED | REJECTED | CANCELLED`.
- `ShiftTemplate` — recurring shift pattern. Has `dayOfWeek Int?` (null when `weekdaysOnly=true`), `weekdaysOnly Boolean`, `metadata Json?` (`{ type, label, shift }`). Used for bulk generation.
- `WaiterPassport` — one-to-one with `WAITER` User. Has `passportTier PassportTier @default(FREE)`, `subscriptionExpiresAt DateTime?`, `monriPanToken String?` (stored pan_token from Monri for recurring charges). Indexed on `passportTier`. `workMunicipalities String[]` — Belgrade opštine the waiter will work in (declared reach; see Waiter Search "Reach filter"). No home coordinates — reach is coarse and non-identifying by design.
- `PassportPayment` — payment record per checkout attempt. Has `userId`, `orderNumber` (unique, `EK-` prefix), `tier PassportTier`, `amountRsd Int` (minor units), `status String` (`PENDING | SUCCESS | FAILED | CANCELLED`), `monriApprovalCode String?`, `monriPanToken String?`. Indexed on `userId`, `orderNumber`, `status`. Idempotent: callback checks status before updating.
- `Notification` — in-app notification record. Has `type NotificationType`, `title`, `body`, `link`, `read`, `pushSent`, `waSent`, `smsSent`.
- `PushSubscription` — browser Web Push subscription per user. Has `endpoint` (unique), `p256dh`, `auth`.

## i18n (Language Switcher)

Lightweight React Context — no next-intl, no route restructuring.

- `src/lib/i18n/index.ts` — `Lang` type (`"sr" | "en" | "ru"`), `FLAGS` array (inline SVG, no emoji), translation map keyed by namespace + key
- `src/components/providers/LanguageProvider.tsx` — `useState<Lang>("sr")`, reads/writes `ek_lang` to `localStorage`, type-safe `t(namespace, key)` helper
- `src/components/ui/FlagSwitcher.tsx` — three inline SVG flag buttons (Serbia, UK, Russia); active = orange ring + scale-110. Use emoji flags nowhere — they don't render on Windows 10.

Translated so far: the preloader (`/`), the auth flow (`login`, `register`, `resetPassword` namespaces), and the **waiter dashboard nav** (`waiterNav` namespace — CQ-K rollout scaffold). Add new keys to `src/lib/i18n/index.ts` under the relevant namespace.

**Rollout pattern (follow this to translate a new surface):**
1. Add a namespace to all three langs (`sr`/`en`/`ru`) in `src/lib/i18n/index.ts`. `TranslationNamespace` is derived from `translations.sr`, so the new namespace + its keys are type-checked automatically.
2. In the client component, `const { t } = useLang()` and render `t("namespace", "key")`. For dynamic keys driven by a union type (e.g. nav `item.key: Section`), give the namespace a key for every union member so `t(ns, item.key)` type-checks — see `waiterNav` (keyed by all `Section` values).
3. Drop `<FlagSwitcher />` somewhere on the surface if it isn't already reachable (the waiter dashboard puts it in the sidebar footer).

Not yet translated (next rollout targets): `SECTION_TITLES`, sign-out / role labels, and the venue/headhunter/admin dashboards. `LanguageProvider` is mounted globally in `app/layout.tsx`, so `useLang()` works in any client component.

## Public Landing Pages

Three pages under `src/app/(public)/`:

| Route | File | Purpose |
|---|---|---|
| `/` | `page.tsx` | Role-picker preloader — two cards linking to `/for-venues` and `/for-waiters` |
| `/for-venues` | `for-venues/page.tsx` | Venue owner landing — hero, pain points, ROI section, comparison table, pricing (`#cenovnik`), demo form (`#demo`) |
| `/for-waiters` | `for-waiters/page.tsx` | Waiter Passport™ landing — animated passport card, tier ladder, owner-view mockup, FAQ |
| `/landing` | `landing/page.tsx` | Original shared landing page (preserved) |

Both `/for-venues` and `/for-waiters` have **page-specific in-page nav menus** (no cross-links). Anchor IDs:
- for-venues: `#kako-radi`, `#cenovnik`, `#faq`, `#demo`
- for-waiters: `#kako-radi`, `#tierovi`, `#faq`

### NavAuthButton

`components/ui/NavAuthButton.tsx` — client component used in both landing page navs.

- Logged out → renders "Prijava" → `/login`
- Logged in → renders "Dashboard →" → role-based path (`/venue`, `/waiter`, `/headhunter`, `/admin`)

Uses `useSession` from next-auth/react. Import and drop into any public nav.

## Dashboard Tour

First-login guided tour for venue owners via `driver.js`.

### Hook: `useDashboardTour`

`src/hooks/useDashboardTour.ts` — call inside `VenueDashboard`:

```typescript
const { startTour } = useDashboardTour(session?.user);
```

- Auto-fires when `session.user.tourCompleted === false` (first login only)
- `startTour()` is also returned for manual re-trigger (wired to "Vodič" button on Pregled)
- Detects mobile (`window.innerWidth < 768`) and builds steps with correct ID prefixes
- On tour close/finish: `PATCH /api/user/tour-complete` (fire-and-forget)

### Tour element IDs

Mobile and desktop nav items have **different ID prefixes** to avoid `querySelector` collision (both are in the DOM simultaneously, mobile drawer is `display:none` on desktop):

| Element | Desktop ID | Mobile ID |
|---|---|---|
| Sidebar container | `tour-sidebar-desktop` | `tour-sidebar` |
| Nav items | `tour-nav-{key}` | `mob-tour-nav-{key}` |
| Notification bell wrapper | `tour-notifications` | `tour-notifications` |
| Profile avatar | `tour-profile-avatar` | `tour-profile-avatar` |

`navContent()` in venue/page.tsx accepts an `idPrefix` param — pass `"mob-tour"` for the mobile drawer call, default `"tour"` for desktop.

On mobile, `handleStartTour` calls `setMobileOpen(true)` + `setTimeout(startTour, 320)` to let the drawer slide animation finish before driver.js queries element positions.

### tourCompleted in JWT

`User.tourCompleted` is seeded into the JWT at login (`authorize → jwt → session` callbacks in `lib/auth/config.ts`). No DB query needed at runtime. Caveat: if a user completes the tour, the JWT still shows `false` until they re-login. The `PATCH /api/user/tour-complete` call is idempotent so re-showing and re-completing is harmless.

### Styling

driver.js popover overrides are in `globals.css` under `/* ── driver.js tour overrides */`. Background `#1a0e02`, orange title/buttons. `backdrop-filter: none` + `transform: translateZ(0)` prevent blur bleed-through from the sticky header's `backdropFilter: blur(12px)`.

## Trust Score

Bayesian scoring in `lib/scoring/trust-score.ts`. Score is 0–100.

**Venue dimensions:** atmosphere, organization, pay, tips, hygieneStandards, management

**Waiter dimensions:** punctuality, skill, guestCommunication, personalHygiene, teamwork, speed

**Guest review dimensions:** friendliness, guestSpeed, attentiveness (these feed into the waiter's passport score)

`ID_VERIFIED` users get a ×1.2 weight multiplier on their reviews.

Score sync flow (run by the publish-reviews cron):
1. `publishDueReviews()` from `lib/scoring/review-lifecycle.ts` — moves PENDING reviews to PUBLISHED after the embargo window (2h for guest, 48h for others)
2. `syncVenueTrustScore(venueId)` from `lib/scoring/sync.ts` — recalculates venue score
3. `syncPassportScore(waiterId)` from `lib/scoring/sync.ts` — recalculates waiter passport score

`lib/scoring/review-lifecycle.ts` — review state machine (time-based status transitions). Import `publishDueReviews` from here, not from `lib/scoring/sync.ts`.

The cron endpoint `POST /api/cron/publish-reviews` runs this flow on a schedule. Requires `Authorization: Bearer <CRON_SECRET>`.

### Cron authorization

All cron routes use `isCronAuthorized(req)` from `lib/auth/cron-auth.ts`. **Never define a local `isAuthorized()` in a cron route** — it was previously copy-pasted 3× and has been consolidated.

```typescript
import { isCronAuthorized } from "@/lib/auth/cron-auth";

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}
```

### Notification retry cron

`POST /api/cron/retry-notifications` — hourly job that retries failed WhatsApp and SMS sends.

- Queries `Notification` where `waSent=false AND waRetries<3` (or same for SMS), `createdAt` within last 24h, user not deleted
- Re-checks tier eligibility at retry time (subscription may have changed)
- On success: sets `waSent`/`smsSent = true`
- On failure: increments `waRetries`/`smsRetries`; stops retrying once count reaches 3
- Returns `{ checked, waSent, waFailed, smsSent, smsFailed }`

The cron is a **pure orchestrator** — retry helpers live in `lib/notifications/retry.ts`:

```typescript
// lib/notifications/retry.ts — used only by retry-notifications cron
retryWhatsApp(notificationId, phone, role, passport, title, body) → "sent" | "failed" | "skipped"
retrySms(notificationId, phone, role, passport, title, body, link?) → "sent" | "failed" | "skipped"
```

Both functions apply the same role-bypass logic as `notify()` (non-WAITER roles skip tier gating). Do **not** call `sendWhatsApp`/`sendSms` directly from cron routes — use these helpers.

`notify()` increments `waRetries`/`smsRetries` on initial send failure instead of silently swallowing the error.

**Notification module structure:**
- `lib/notifications/dispatch.ts` — `dispatchPush`, `dispatchWhatsApp`, `dispatchSms`, `buildSmsText` (pure network, no DB writes, no tier checks)
- `lib/notifications/notify.ts` — `notify()` coordinator (DB create + tier check + dispatch orchestration + email fallback)
- `lib/notifications/retry.ts` — `retryWhatsApp`, `retrySms` (used only by retry-notifications cron)

## OAuth (Google / Facebook)

NextAuth is configured with `PrismaAdapter(dbRaw)` + JWT strategy. Adapter persists User + Account rows for OAuth sign-ins; JWT strategy keeps sessions stateless.

**Providers:** GoogleProvider, FacebookProvider — credentials in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`.

**New user flow:**
- `pages.newUser = "/onboarding/select-role"` — fires for first-time OAuth users
- Role picker at `/onboarding/select-role` calls `PATCH /api/auth/set-role` then `update({ role })` (NextAuth v4 session update) so the JWT reflects the new role immediately
- User is then routed to the role-specific onboarding page

**`PATCH /api/auth/set-role` { role }**
- Auth required. Accepts `WAITER | VENUE_OWNER | HEADHUNTER` only (no ADMIN escalation).
- **One-time guard:** only succeeds for users still in onboarding state — `role === "WAITER"` (OAuth default) AND no `WaiterPassport` yet. Any established user (non-WAITER role, or WAITER with a passport) receives 403. Prevents role re-assignment after onboarding.
- Updates `User.role` in DB.

**JWT callback (lib/auth/config.ts):**
- `trigger === "update"` with `session.role` → re-fetches role from DB and writes DB value to token (never trusts client-supplied role — privilege escalation guard). No re-auth needed.
- OAuth first sign-in: `account.provider !== "credentials"` → fetches role/verificationTier/tourCompleted from DB (adapter only returns basic fields)
- Credentials first sign-in: `authorize()` already returns all fields

**signIn callback:** rejects sign-ins for soft-deleted users (`deletedAt IS NOT NULL`).

**Token revocation cache (`lib/auth/revocation.ts`):**
- `isTokenRevoked(userId, tokenIat)` — checks in-process LRU cache (60s TTL, 5 000-entry cap) before hitting `TokenRevocation` table. Imported by `lib/auth/config.ts`; intentionally isolated so the cache can be unit-tested without importing `authOptions`.
- `_clearRevCacheForTests()` — exported for test teardown only.

**Account linking:** not implemented — same-email collision between credentials and OAuth returns a NextAuth error. Users must use the provider they originally signed up with.

## Password Reset Flow

```
POST /api/auth/forgot-password  { email }
  No auth. Rate-limited: 3/15min per IP (silent — always returns { ok: true } to prevent email enumeration).
  Looks up user by email. If user has no hashedPassword (OAuth-only account), silently returns ok.
  Creates PasswordResetToken (token: 32 random bytes hex, expiresAt: +1h).
  Sends email via lib/integrations/email.ts (nodemailer SMTP — configured via SMTP_* env vars).

POST /api/auth/reset-password  { token, password }
  No auth. Validates: token exists, not usedAt, not expired, password ≥ 8 chars.
  Transaction: update User.hashedPassword (bcrypt cost 12) + set PasswordResetToken.usedAt.
  Returns { ok: true } on success; 400 with { error } on failure.
```

**Page:** `/reset-password` (lives in `(auth)` layout)
- Without `?token=` in URL → "Resetuj lozinku" email form → on submit shows "Proveri inbox" confirmation
- With `?token=XYZ` → "Nova lozinka" form with strength indicator → on success auto-redirects to `/login` after 2.5s

Login page links to `/reset-password` ("Zaboravili ste lozinku?").

**SMTP env vars** (in `.env.example`):
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Works with Gmail (app password), Outlook, SendGrid SMTP relay, etc.
- No-op during development if vars missing — `sendPasswordResetEmail` catch swallows send errors

**PasswordResetToken model** — separate table (not fields on User). Cascades on user delete. Token column is unique + indexed.

## API Conventions

- All routes use Next.js Route Handlers (`route.ts`)
- Auth check: use `withRole` / `withAuth` from `lib/auth/with-role.ts` (see below). Avoid calling `getServerSession` directly in new routes.
- Body validation: use `parseBody` / `parseQuery` from `lib/auth/parse-body.ts` (see below).
- Rate limiting: `checkRateLimit(userId, action, max)` from `lib/core/rate-limit.ts`

### Middleware API auth layer

`src/middleware.ts` protects ALL `/api/*` routes. Unauthenticated requests to any route **not** in `PUBLIC_API_PATTERNS` receive a `401 JSON` response before the route handler runs.

**When adding a genuinely public route** (no session needed), add its pattern to `PUBLIC_API_PATTERNS` in `src/middleware.ts`. Current public patterns:
- `/api/auth/*` — NextAuth + forgot/register/reset
- `/api/cron/*` — Bearer-token cron jobs
- `/api/reviews/guest` — guest review POST
- `/api/reviews` — published review feed (GET)
- `/api/venues/[id]/public` — public venue info
- `/api/venues/[id]` — single venue GET (marketplace)
- `/api/venues/geojson`, `/api/jobs/geojson` — map data
- `/api/passport/public/*` — share-link passport
- `/api/payments/monri/(callback|success|cancel)` — Monri webhook + redirects

Route handlers still use `withRole`/`withAuth` as the primary guard — the middleware is defense-in-depth only.

### useRequireRole (client pages)

`src/hooks/useRequireRole.ts` — guards a client page behind role-based auth. Use in every `"use client"` dashboard or protected page instead of a raw `useEffect` redirect.

```typescript
import { useRequireRole } from "@/hooks/useRequireRole";

// Standard — redirects to /login when unauthenticated, "/" when wrong role
const { status } = useRequireRole("VENUE_OWNER");
if (status === "loading") return <PageSkeleton />;

// With callbackUrl (e.g. post-login return)
const { status } = useRequireRole("WAITER", { loginUrl: `/login?callbackUrl=/apply/${jobId}` });

// When session data is needed for rendering (e.g. display user name)
const { session, status } = useRequireRole("HEADHUNTER");
```

Do **not** write `useEffect(() => { if (status === "unauthenticated") router.push... })` inline in pages — this pattern was removed from all 17 dashboard/protected pages and must not be reintroduced.

### useDashboardNav (dashboard root pages)

`src/hooks/useDashboardNav.ts` — bundles shared nav state for every dashboard root component. Generic over `<S>` so each dashboard keeps its own `Section` type.

```typescript
import { useDashboardNav } from "@/hooks/useDashboardNav";

// In VenueDashboard / WaiterDashboard / any dashboard root:
const { section, setSection, notifUnread, setNotifUnread, today } =
  useDashboardNav<Section>("overview");
```

Returns:
- `section` / `setSection` — active section state
- `notifUnread` / `setNotifUnread` — unread notification count (fed into `NotificationBell.onUnreadChange`)
- `today` — Serbian-locale date string passed to `DashboardShell.today`

Do **not** inline `useState<Section>`, `useState(0)` for notifUnread, or the `toLocaleDateString("sr-Latn-RS", ...)` today computation in dashboard root pages — use this hook.

### useApi (client data fetching)

`src/hooks/useApi.ts` — shared GET data-fetching hook. Replaces the hand-rolled `useState(data)` + `useState(loading)` + `useEffect(fetch)` + `.catch(() => {})` triplet duplicated across section components. Encapsulates loading/error state, unmount-safety, and the silent background-poll pattern.

```typescript
import { useApi } from "@/hooks/useApi";

const { data, isLoading, error, mutate } = useApi<MarketData>("/api/insights/market");

// Conditional + polling (e.g. only fetch on active tab, refresh every 30s silently):
const { data: open } = useApi<OpenShift[]>("/api/shifts?view=open", { enabled: tab === "open", refreshMs: 30_000 });
```

Returns `{ data, error, isLoading, mutate }`. `mutate()` refetches (shows loading) and returns a promise. Options: `enabled` (skip while false, default true), `refreshMs` (silent poll interval — no `isLoading` toggle on poll ticks).

Do **not** hand-roll `useState` + `useEffect(fetch)` for a GET in new section components — use this hook. State-heavy section components (`WaiterPassportSection`, `VenueSmeneSection`, `WaiterSmeneSection`) are being migrated onto it to shed their large `useState` counts.

### useWaiterSearch + WaiterCard (waiter-search feature)

`src/hooks/useWaiterSearch.ts` + `src/components/ui/WaiterCard.tsx` — the **single** way to query and render `GET /api/waiters`. Before CQ-P three clients (`headhunter/search`, venue `DiscoverSection`, `venue/invites`) each hand-rolled the querystring + fetch + result-card markup. Never rebuild that inline — use these.

```typescript
import { useWaiterSearch, type WaiterFilters } from "@/hooks/useWaiterSearch";
import { WaiterCard } from "@/components/ui/WaiterCard";

// Reactive filters (chips): refetches when the query string changes
const { waiters, isLoading } = useWaiterSearch<WaiterEntry>({ available, minScore });

// Button-triggered search (headhunter): hold draft vs applied, fetch only on submit
const [draft, setDraft]     = useState<WaiterFilters>({});
const [applied, setApplied] = useState<WaiterFilters>({});
const { waiters } = useWaiterSearch<Waiter>(applied, { enabled: status === "authenticated" });
// <button onClick={() => setApplied({ ...draft })}>Pretraži</button>

// Conditional (collapsed panel): enabled skips the fetch
const { waiters } = useWaiterSearch<VenueInviteWaiter>({ search }, { enabled: showSearch });
```

- `buildWaiterQuery(filters)` — pure, exported, unit-tested. Omits empty/falsy params. Import it (don't rebuild `URLSearchParams`) if you need the query string without the fetch.
- The hook is generic over the row shape `<T>` — each caller keeps its own typed response; no forced cross-file type merge.
- `WaiterCard` renders avatar + name + tier/passport badges + score + skills + availability. Inject surface-specific buttons via the `actions` slot; toggle the stats grid with `showStats`; cap skill chips with `maxSkills`. Compact list rows (e.g. `venue/invites`) that need a genuinely different, smaller presentation may keep their own markup — but must still use `useWaiterSearch` for the fetch.

### withRole / withAuth

`lib/auth/with-role.ts` — wraps a route handler with session auth + role check. The handler receives the typed `Session` — no need to call `getServerSession` again.

```typescript
import { withRole, withAuth } from "@/lib/auth/with-role";

// Single role
export const GET = withRole("ADMIN", async (req, ctx, session) => {
  // session.user.role, session.user.id, etc. are all typed
  return NextResponse.json({ ok: true });
});

// Multiple roles
export const POST = withRole(["VENUE_OWNER", "ADMIN"], async (req, ctx, session) => {
  return NextResponse.json({ ok: true });
});

// Any authenticated user (no role restriction)
export const GET = withAuth(async (req, ctx, session) => {
  return NextResponse.json({ userId: session.user.id });
});
```

Returns 401 when no session, 403 when wrong role.

### parseBody / parseQuery

`lib/auth/parse-body.ts` — validates request body or query params against a Zod schema. Returns a discriminated union — check `result.ok` before accessing `result.data`.

```typescript
import { parseBody, parseQuery } from "@/lib/auth/parse-body";
import { z } from "zod";

const Schema = z.object({ title: z.string().min(1), count: z.number().int().positive() });

export const POST = withRole("VENUE_OWNER", async (req, ctx, session) => {
  const parsed = await parseBody(Schema, req);
  if (!parsed.ok) return parsed.response; // auto 400 with Zod error details

  const { title, count } = parsed.data; // fully typed
  // ...
});

// For GET endpoints with query params:
const QuerySchema = z.object({ page: z.coerce.number().default(1) });
const parsed = parseQuery(QuerySchema, req); // synchronous
```
- GeoJSON endpoints (`/api/venues/geojson`, `/api/jobs/geojson`) accept bounding box params: `swLat`, `swLng`, `neLat`, `neLng` (validate with `BBoxSchema` — see "Map GeoJSON endpoints")
- `GUEST_TO_WAITER` and `GUEST_TO_VENUE` reviews require `guestLatitude` and `guestLongitude` in the request body (when `geofenceEnabled`)
- Guest review submissions go to `POST /api/reviews/guest` (no auth) — not the main `/api/reviews` route
- `GET /api/venues/[id]/reviews` — owner-only feed; returns all non-REMOVED reviews across all directions for the venue

## Review Lifecycle

```
POST /api/reviews (or /guest) → status: PENDING, notifies venue owner (REVIEW_RECEIVED)
  Venue owner can immediately PATCH /api/reviews/[id] { action: "approve" | "reject" }
    approve → PUBLISHED, publishedAt = now, triggers score sync
    reject  → REMOVED (drops from all feeds)
  OR wait for cron:
  2h later (guest) / 48h later (venue/waiter) → publishDueReviews() → PUBLISHED
  if isHighFriction() (score ≥60 swing) → DISPUTED
```

```
PATCH /api/reviews/[id]  { action: "approve" | "reject" }
  VENUE_OWNER only (must own the review's venue). Only PENDING reviews.
  approve → status: PUBLISHED, publishedAt: now
          → syncVenueTrustScore (WAITER_TO_VENUE | GUEST_TO_VENUE)
          → syncPassportScore   (VENUE_TO_WAITER | GUEST_TO_WAITER)
  reject  → status: REMOVED, no score sync
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
  Body: { method: "GPS" | "QR", latitude?, longitude? }
  Window: scheduledStart - 15min to scheduledStart + 60min

  GPS distance logic (three tiers):
    < 50m              → clockInMethod: GPS, auto-approved
    50–150m            → clockInMethod: GPS_GRACE, auto-approved silently
    > 150m or no GPS   → pendingClockIn: true, notifies venue owner
                          returns { pending: true } with HTTP 202

  → records clockInAt, clockInMethod, lateMinutes on ShiftAssignment (if approved)
  → sets pendingClockIn = true if outside grace zone (awaits manager approval)

PATCH /api/shifts/assignments/[id]/approve-clockin
  VENUE_OWNER only (must own the shift venue).
  Body: { action: "approve" | "reject" }
  approve → clockInAt = now, clockInMethod = MANUAL, pendingClockIn = false, notifies waiter
  reject  → pendingClockIn = false, notifies waiter
```

**Waiter UI:** `ClockInButton` shows amber "Čekamo odobrenje..." pill when `pendingClockIn`. No auto-MANUAL fallback — GPS failure triggers pending approval instead.

**Venue UI:** `PendingClockInRow` renders on shift cards for assignments with `pendingClockIn = true`. One-tap Odobri/Odbij buttons call the approve-clockin route and refresh.

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

**`GET /api/shifts?view=manage`** (head-waiter management view) returns `200 { venue: null, shifts: [] }` for a waiter who heads no venue — **not** `403`. Managing nothing is not "forbidden", and the waiter dashboard fetches this on every load; a 403 there just spams logs/Sentry (CQ-L). Keep the empty-200 shape; clients guard on `m?.venue`.

### Swap flow

```
POST /api/shifts/[id]/swap  { toWaiterId }
  → creates ShiftSwapRequest (status: PENDING)
  → shift status → PENDING_SWAP
  → notifies target waiter + venue owner

PATCH /api/shifts/swaps/[swapId]  { action: "ACCEPTED" | "REJECTED" }
  VENUE_OWNER only.
  ACCEPTED → atomic: update fromAssignment.waiterId = toWaiterId (in-place transfer, not delete+create — delete would violate the ON DELETE RESTRICT FK on ShiftSwapRequest.fromAssignmentId), swap status → ACCEPTED, shift status → ASSIGNED
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
  VENUE_OWNER or HEADHUNTER. Returns max 100 waiters ordered by tier rank desc, then passport score desc.
  Query params (all optional):
    available=true          → passport.currentlyAvailable = true
    minScore=N              → passport.score >= N
    sanitaryBook=true       → passport.sanitaryBookValid = true
    verificationTier=TIER   → UNVERIFIED | SILVER | GOLD | ID_VERIFIED
    skills=a,b,c            → passport.skills hasSome [a,b,c]
    languages=a,b           → passport.languages hasSome [a,b]
    minExperience=N         → passport.yearsExperience >= N
    municipality=NAME       → passport.workMunicipalities has NAME (waiter's declared reach)
    search=text             → user.name contains text (case-insensitive)
```

**Reach filter (`municipality`):** waiters declare `workMunicipalities` (Belgrade gradske opštine they will work in) on their passport; owners/headhunters filter by it. Both sides pick from the canonical `BELGRADE_MUNICIPALITIES` in `lib/geo/municipalities.ts`, so the match is an exact `has` — never a fuzzy join on the free-text `Venue.municipality`. **No waiter home coordinates are stored** — the question the feature answers is "will he come", not "where does he sleep", and plotting real people's homes for every owner to browse is a privacy non-starter. Add a filter param via `buildWaiterQuery`/`WaiterFilters` (`hooks/useWaiterSearch.ts`) so all three search clients inherit it. `PUT /api/passport` runs `sanitizeMunicipalities` before persisting (drops junk/dupes/casing drift) so the value stays clean for the filter and the future coverage choropleth.

**Beograd-only today, Serbia later:** `BELGRADE_MUNICIPALITIES` is the seam. Serbia-wide means a city→municipalities map keyed off `lib/geo/cities.ts`; the `String[]` shape and the `has` filter do not change.

**Tier-based ranking:** After the DB query, results are sorted in-memory: PRO_PLUS (rank 2) → PRO (rank 1) → FREE (rank 0), then by score descending within each tier. Expired subscriptions are treated as FREE. This is done in-memory (not at DB level) because expiry comparison requires runtime Date logic.

## Zone Analytics

```
lib/geo/analytics.ts — zone insight helpers (use dbRaw, not db):

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

GET /api/admin/stats
  13 parallel queries. Returns: users by role, passports by tier, active venues,
  open/red-alert jobs, applications, reviews by status, sanitary pending count,
  total successful payments, revenue this month (amountRsd / 100 = dinars).

GET /api/admin/activity
  Last 25 events merged and sorted across User (registrations), PassportPayment
  (SUCCESS), Review, and JobApplication. Each event: { id, type, title, sub, ts, link? }.
  Types: "registration" | "payment" | "review" | "application".

GET /api/admin/users?search=&role=&page=
  Paginated (25/page). search = name or email (case-insensitive). role = enum filter.
  Returns { users, total, page, pages }. Each user includes waiterPassport tier + score.

PATCH /api/admin/users/[id]  { role? | action: "delete" | "restore" }
  Soft-delete sets deletedAt. restore clears it. role change validates against enum.
  Blocks self-modification (403 if id === session.user.id).

GET /api/admin/health
  Returns system health metrics:
  - reviews.overdueGuest   — PENDING guest reviews older than 2h (should be 0 if cron runs)
  - reviews.overdueRegular — PENDING non-guest reviews older than 48h
  - passports.expiredPaid  — WaiterPassport with non-FREE tier but subscriptionExpiresAt < now
                             (DB stale — runtime already treats these as FREE)
  - cron.lastPublishedReviewAt  — proxy for publish-reviews cron last-ran timestamp
  - cron.lastRenewalPaymentAt   — proxy for renew-subscriptions cron last-ran timestamp
  - users.softDeleted           — count of users with deletedAt set
  - system.pendingClockIns      — ShiftAssignment rows with pendingClockIn = true
  - system.rateLimitEntries     — RateLimit row count (spike = heavy use or abuse)
```

### Notification Preferences API

```
GET /api/user/notification-prefs
  Returns { phone, smsOptIn, waOptIn } for the authenticated user.

PATCH /api/user/notification-prefs  { phone?, smsOptIn?, waOptIn? }
  Updates User.phone (trimmed, max 20 chars, null if empty string),
  smsOptIn, and/or waOptIn. Partial updates — only present keys are applied.
```

## Notification System

### Dispatch flow

```
notify(userId, type, title, body, link?)
  → 1. db.notification.create (always)
  → 2. web push to all PushSubscription rows (VAPID, free for all tiers)
      expired subs (410/404) auto-deleted
  → 3. WhatsApp template msg if isPro && user.waOptIn && user.phone
      (isPro = active PRO or PRO_PLUS passport tier)
  → 4. Infobip SMS if isProPlus && user.smsOptIn && user.phone
      (isProPlus = active PRO_PLUS passport tier only)
```

### VAPID setup (one-time)

```bash
npx web-push generate-vapid-keys
# Add to .env:
# VAPID_PUBLIC_KEY=...
# VAPID_PRIVATE_KEY=...
# NEXT_PUBLIC_VAPID_KEY=...  ← same as VAPID_PUBLIC_KEY, browser-exposed
```

**CSP requirement:** the web-push service worker (`/sw.js`) is a same-origin worker, so the `next.config.ts` CSP `worker-src` directive **must include `'self'`** (`worker-src 'self' blob:` — `blob:` is for Mapbox GL). Dropping `'self'` silently blocks SW registration and kills push entirely (the `togglePush` failure is swallowed). This regressed once (CQ-M) — do not remove `'self'`.

### WhatsApp templates

Template name is set via `WA_TEMPLATE_NAME` env var (default: `ekonobar_notification`). The template must be approved in Meta Business Manager before use. Template parameters: `[title, body]`.

### SMS format

Infobip messages are truncated to 160 chars: `"${title}: ${body} | ekonobar.rs"`.

## Passport Pro Subscriptions

Waiters can upgrade their passport tier for priority features. Venues are commission-only — no subscription fees.

### Tiers

| Tier | Price | Features |
|---|---|---|
| `FREE` | 0 RSD | Basic passport, web push notifications, Red Alert access (30-min delay) |
| `PRO` | 290 RSD/mo | + WhatsApp notifications, priority in search results, Red Alert early access |
| `PRO_PLUS` | 490 RSD/mo | + SMS notifications, first in search results (rank 2 vs PRO rank 1) |

### Tier resolution

Always check at runtime — never cache tier in JWT:

```typescript
const passport = await db.waiterPassport.findUnique({ where: { userId } });
const isActive = passport?.subscriptionExpiresAt
  ? passport.subscriptionExpiresAt > new Date()
  : false;
const effectiveTier = isActive ? passport.passportTier : "FREE";
const isPro     = isActive && (effectiveTier === "PRO" || effectiveTier === "PRO_PLUS");
const isProPlus = isActive && effectiveTier === "PRO_PLUS";
```

### Subscription API

```
GET /api/passport/subscription
  WAITER only. Returns { tier, subscriptionExpiresAt, isActive, daysRemaining }.

POST /api/passport/subscribe  { tier: "FREE" | "PRO" | "PRO_PLUS" }
  WAITER only.
  FREE → clears subscription immediately (cancels).
  PRO/PRO_PLUS → extends 30 days from now (or from current expiry if still active).
  Note: this is the direct/admin path. Normal user path goes through Monri checkout.
```

### Subscription renewal cron

`POST /api/cron/renew-subscriptions` — daily job that charges stored `monriPanToken` for passports expiring within 25h.

- Queries `WaiterPassport` where `passportTier IN [PRO, PRO_PLUS]`, `monriPanToken IS NOT NULL`, `subscriptionExpiresAt` in `[now-1h, now+25h]`
- Dedup guard: skips users with a `PassportPayment` in `status IN [PENDING, SUCCESS]` created in the last 2h
- On success: extends `subscriptionExpiresAt` by 30 days from the **current expiry** (not `now`), to avoid date drift on late cron runs
- On failure: marks payment FAILED, lets subscription lapse naturally — does **not** force-downgrade `passportTier`. User notified to resubscribe.
- Returns `{ checked, renewed, failed }`

## Monri Payment Integration

Visa/Mastercard/DinaCard payment via Monri WebPay (Serbian gateway). Replaces any Stripe/PayPal — Monri is the only payment provider.

### Environment variables

```env
MONRI_ENV="test"                  # "test" | "production"
MONRI_MERCHANT_KEY=""             # from Monri dashboard → API keys
MONRI_AUTHENTICITY_TOKEN=""       # from Monri dashboard → API keys
```

Test endpoint: `https://ipgtest.monri.com`  
Production endpoint: `https://ipg.monri.com`

### lib/integrations/monri.ts

```typescript
import { createPaymentSession, verifyCallback, callbackApproved } from "@/lib/monri";
```

- `requestDigest(params)` — `SHA512(authenticity_token + order_number + amount + currency)` — included in checkout POST
- `callbackDigest(payload)` — `SHA512(merchant_key + approval_code + order_number + amount)` — used to verify server-to-server callbacks
- `createPaymentSession(params)` — POSTs to `/v2/payment/new`, returns `{ paymentUrl, orderId }`
- `verifyCallback(payload)` — compares expected vs received digest; returns boolean
- `callbackApproved(payload)` — checks `response_code === "0000" && status === "approved"`
- `chargeStoredCard(params)` — recurring charge using stored `monriPanToken` (not yet used)

### Payment flow

```
POST /api/payments/monri/checkout  { tier: "PRO" | "PRO_PLUS" }
  WAITER only.
  → Creates PassportPayment record (status: PENDING, orderNumber: EK-{16 hex chars})
  → Calls createPaymentSession()
  → Returns { paymentUrl } — frontend redirects the user

User pays on Monri-hosted page →

POST /api/payments/monri/callback  (Monri server-to-server, no auth)
  Body: application/x-www-form-urlencoded or JSON
  → verifyCallback(): digest mismatch → 400
  → Idempotency: already SUCCESS → 200 (skip)
  → callbackApproved():
      YES → dbRaw.$transaction:
              PassportPayment status=SUCCESS, approvalCode, panToken
              WaiterPassport tier=tier, subscriptionExpiresAt=+30days, monriPanToken
            notify() fire-and-forget (APPLICATION_STATUS_CHANGED)
      NO  → PassportPayment status=FAILED
  → Returns { ok: true }

GET /api/payments/monri/success?order_number=...
  → Redirects to ${NEXT_PUBLIC_APP_URL}/waiter?payment=success&order={orderNumber}

GET /api/payments/monri/cancel?order_number=...
  → Updates PassportPayment PENDING → CANCELLED
  → Redirects to ${NEXT_PUBLIC_APP_URL}/waiter?payment=cancelled
```

### Waiter dashboard payment UX

After redirect back from Monri, `WaiterDashboard` reads `?payment=success|cancelled` from the URL on mount, shows a toast, cleans the URL with `window.history.replaceState`, and auto-navigates to the passport section on success.

### Callback security

**Always use `dbRaw` in the Monri callback handler**, not `db`. The callback is unauthenticated (Monri server → our server) and needs to update `PassportPayment` which has no `deletedAt` field — but using `dbRaw` is still correct here to avoid any soft-delete filter issues.

Configure the callback URL in Monri dashboard: `https://your-domain.com/api/payments/monri/callback`
