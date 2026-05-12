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

## Tests

Two patterns in use:

- **Pure function tests** (`src/lib/__tests__/`) — no mocking; test trust-score and geofence helpers directly.
- **Route handler tests** (`src/app/api/reviews/[id]/__tests__/`) — use `vi.mock()` to mock `next-auth`, `@/lib/db`, and `@/lib/sync-scores`; call the exported handler function directly; assert on `Response.status` and mock call args.

When adding route handler tests, mock at the module level with `vi.mock(...)` before imports, use `vi.clearAllMocks()` in `beforeEach`, and flush fire-and-forget promises with `await new Promise(r => setTimeout(r, 0))`.

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

`NotificationType` enum values: `APPLICATION_RECEIVED`, `APPLICATION_STATUS_CHANGED`, `SWAP_REQUESTED`, `SWAP_RESOLVED`, `SHIFT_CLAIMED`, `SHIFT_ASSIGNED`, `REVIEW_RECEIVED`, `REVIEW_PUBLISHED`, `CLOCKIN_APPROVAL_REQUESTED`, `CLOCKIN_RESOLVED`.

- `REVIEW_RECEIVED` — fires to venue owner when any review is submitted (WAITER_TO_VENUE, GUEST_TO_VENUE, GUEST_TO_WAITER)

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
- Exports `NotificationItem` type, `TYPE_ICONS` map, and `timeAgo()` helper — imported by `NotificationsSection`

### NotificationsSection

`components/ui/NotificationsSection.tsx` — full-page notification feed. Renders inside the dashboard when `section === "notifications"`:

- Filter chips: Sve / Prijave / Smene / Zamene / Recenzije (maps to `NotificationType` subsets)
- Notifications grouped by day: "Danas" / "Juče" / weekday + date (Serbian locale)
- Click any row → marks as read + navigates to `n.link`
- "Označi sve pročitanim" button when unread > 0
- Per-item read via `PATCH /api/notifications { ids: [id] }` (optimistic UI, then confirm)

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

`POST /api/reviews/guest` accepts unauthenticated submissions. Supports two directions via the `direction` field (default: `"GUEST_TO_WAITER"`):

- `GUEST_TO_WAITER` — requires `subjectId` (waiter); stores `ratingFriendliness`, `ratingGuestSpeed`, `ratingAttentiveness`; fires `syncPassportScore`
- `GUEST_TO_VENUE` — no `subjectId`; stores `ratingAtmosphere`, `ratingOrganization`, `ratingHygieneWork`; fires `syncVenueTrustScore`

`Review.authorId` is nullable — null means guest. Display as "Gost" in UI. `guestHandle` is an optional display name (max 50 chars). The route is rate-limited by IP (3/hour) and geofenced server-side (150m). After creation, `REVIEW_RECEIVED` is sent to the venue owner.

The `/review/[venueId]` public page presents a 3-choice flow: "Oceni restoran" (GUEST_TO_VENUE), "Oceni konobara" (GUEST_TO_WAITER), "Oceni oba" (both — two sequential POSTs sharing the same geolocation coords).

The public venue info endpoint `GET /api/venues/[id]/public` returns venue + accepted waiters list — no auth required.

### Dark dashboard theme

Both venue-owner (`src/app/(dashboard)/venue/page.tsx`) and waiter (`src/app/(dashboard)/waiter/page.tsx`) dashboards share a dark visual theme:

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
- `VenueZone` — map zone (hotspot) for analytics
- `Invite` — venue invite code for GOLD verification
- `RateLimit` — DB-backed rate limit counters (userId + action + hourly window)
- `Shift` — a scheduled shift. Has `scheduledStart DateTime?`, `status ShiftStatus`, `requiredCount`, `templateId?`, `swapLocked`, `briefingNote`, `tipEstimate`.
- `ShiftAssignment` — explicit waiter-to-shift assignment (replaced implicit M2M). Has clock-in fields: `clockInAt`, `clockOutAt`, `clockInMethod` (GPS | GPS_GRACE | QR | MANUAL), `clockInLat`, `clockInLng`, `lateMinutes`, `earlyExitAt`, `pendingClockIn` (awaiting manager approval).
- `ShiftSwapRequest` — swap request between two waiters. Status: `PENDING → ACCEPTED | REJECTED | CANCELLED`.
- `ShiftTemplate` — recurring shift pattern. Has `dayOfWeek Int?` (null when `weekdaysOnly=true`), `weekdaysOnly Boolean`, `metadata Json?` (`{ type, label, shift }`). Used for bulk generation.
- `Notification` — in-app notification record. Has `type NotificationType`, `title`, `body`, `link`, `read`, `pushSent`, `waSent`, `smsSent`.
- `PushSubscription` — browser Web Push subscription per user. Has `endpoint` (unique), `p256dh`, `auth`.

## i18n (Language Switcher)

Lightweight React Context — no next-intl, no route restructuring.

- `src/lib/i18n.ts` — `Lang` type (`"sr" | "en" | "ru"`), `FLAGS` array (inline SVG, no emoji), translation map keyed by namespace + key
- `src/components/providers/LanguageProvider.tsx` — `useState<Lang>("sr")`, reads/writes `ek_lang` to `localStorage`, type-safe `t(namespace, key)` helper
- `src/components/ui/FlagSwitcher.tsx` — three inline SVG flag buttons (Serbia, UK, Russia); active = orange ring + scale-110. Use emoji flags nowhere — they don't render on Windows 10.

Currently only the preloader page (`/`) is translated. Add new keys to `src/lib/i18n.ts` under the relevant namespace.

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

`User.tourCompleted` is seeded into the JWT at login (`authorize → jwt → session` callbacks in `lib/auth.ts`). No DB query needed at runtime. Caveat: if a user completes the tour, the JWT still shows `false` until they re-login. The `PATCH /api/user/tour-complete` call is idempotent so re-showing and re-completing is harmless.

### Styling

driver.js popover overrides are in `globals.css` under `/* ── driver.js tour overrides */`. Background `#1a0e02`, orange title/buttons. `backdrop-filter: none` + `transform: translateZ(0)` prevent blur bleed-through from the sticky header's `backdropFilter: blur(12px)`.

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
