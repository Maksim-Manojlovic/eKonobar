# eKonobar

A verified platform for the hospitality sector in Serbia. Waiters get a portable digital reputation passport, venue owners find and verify staff quickly, and headhunters get advanced talent search tools.

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Database:** PostgreSQL 15 via Prisma ORM
- **Auth:** NextAuth.js v4 (JWT sessions)
- **Maps:** Mapbox GL + react-map-gl v8
- **Charts:** Recharts
- **Image storage:** Cloudinary
- **UI:** Radix UI primitives, Tailwind CSS, lucide-react
- **Tour:** driver.js (first-login guided walkthrough)
- **Validation:** Zod
- **Tests:** Vitest

## Prerequisites

- Node.js 18+
- Docker (for PostgreSQL) or a local PostgreSQL 15 instance

## Setup

```bash
npm install
```

Copy the environment file and fill in the required values:

```bash
cp .env.example .env.local
```

Required variables:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/appdb"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"
NEXT_PUBLIC_MAPBOX_TOKEN="pk.eyJ..."
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

Optional:

```env
CRON_SECRET="your-cron-secret"        # required to call /api/cron/* routes
DEFAULT_REVIEW_RADIUS_KM=0.15

# SMTP (password reset emails) — works with Gmail, Outlook, SendGrid, etc.
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="eKonobar <noreply@ekonobar.rs>"

# Web Push (VAPID) — run: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
NEXT_PUBLIC_VAPID_KEY=""              # same as VAPID_PUBLIC_KEY, browser-exposed

# WhatsApp Business API (Meta Cloud API) — opt-in notifications
WA_ACCESS_TOKEN=""
WA_PHONE_NUMBER_ID=""
WA_TEMPLATE_NAME="ekonobar_notification"

# Infobip SMS — premium opt-in notifications
INFOBIP_API_KEY=""
INFOBIP_BASE_URL="https://api.infobip.com"
INFOBIP_FROM="eKonobar"

# Monri payment gateway (Visa/Mastercard/DinaCard)
# Get credentials: https://dashboard.monri.com
MONRI_ENV="test"                            # "test" | "production"
MONRI_MERCHANT_KEY=""
MONRI_AUTHENTICITY_TOKEN=""

# OAuth providers
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
FACEBOOK_CLIENT_ID=""
FACEBOOK_CLIENT_SECRET=""
```

### Database

Start PostgreSQL with Docker:

```bash
docker-compose up -d
```

Push the schema and generate the Prisma client:

```bash
npm run db:push
npm run db:generate
```

Seed demo data:

```bash
npm run db:seed
```

## Development

```bash
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run all tests (unit + integration — requires `DATABASE_URL`) |
| `npm run test:unit` | Run unit tests only (no DB required) |
| `npm run test:integration` | Run integration tests (requires real PostgreSQL) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:push` | Push schema changes to DB (no migration file) |
| `npm run db:migrate` | Create and apply a named migration |
| `npm run db:studio` | Open Prisma Studio GUI |
| `npm run db:seed` | Seed demo data |

## Project Structure

```
src/
  app/
    (public)/          # Public-facing pages
      page.tsx         # Role-picker preloader (/ route) — two cards → /for-venues, /for-waiters
      for-venues/      # Venue owner landing page (in-page nav: #kako-radi, #cenovnik, #faq, #demo)
      for-waiters/     # Waiter Passport™ landing page (in-page nav: #kako-radi, #tierovi, #faq)
      landing/         # Original shared landing page (/landing)
                       # Also: venue listings, job listings, public passport (/passport/[shareToken])
      review/[venueId]/ # Guest QR review page — 3-choice flow (venue / waiter / both), no auth
    (auth)/            # Login, register, onboarding (waiter | venue | headhunter)
    (dashboard)/
      venue/                    # Venue owner dashboard (dark theme, skeleton loaders, guided tour)
        page.tsx                # Root client component — session + section state only
        venue-types.ts          # Section type + all API response shapes
        venue-helpers.tsx       # Shared UI: PostStatusBadge, VerifiedBadge, ScorePill, Sk, *Skeleton
        VenueJobsSection.tsx
        VenueSmeneSection.tsx   # Shift scheduling UI
        VenueSmeneModals.tsx    # Shift create/edit modals
        VenueDiscoverSection.tsx
        VenueReviewsSection.tsx
        ProfileSection.tsx
        applications/           # /venue/applications sub-page
        invites/                # /venue/invites sub-page
        jobs/                   # /venue/jobs sub-page
        reviews/                # /venue/reviews sub-page
      waiter/                   # Waiter dashboard (dark theme, passport + subscriptions)
        page.tsx                # Root client component
        waiter-types.ts         # Section type + API response shapes
        waiter-helpers.tsx      # Shared UI: StatusBadge, ShiftStatusBadge, Sk, *Skeleton
        WaiterOverviewSection.tsx
        WaiterJobsSection.tsx
        WaiterSmeneSection.tsx
        WaiterPassportSection.tsx
        WaiterInvitesSection.tsx
        WaiterReviewsSection.tsx
        history/                # /waiter/history sub-page
        jobs/                   # /waiter/jobs sub-page
      headhunter/               # Headhunter dashboard
        page.tsx
        saved/                  # Saved profiles list
        search/                 # Waiter search
      admin/                    # Admin dashboard (dark theme, analytics, moderation)
        page.tsx                # Root client component
        admin-types.ts          # PlatformStats, ActivityEvent, HealthData, LeaderboardData, etc.
        admin-helpers.tsx       # DashboardSkeleton, BigStat, MiniStat, SectionCard, timeAgo
        users/                  # User management — search, filter, soft-delete, restore
        venues/                 # Venue list + hard-delete
        analytics/zones/        # Zone analytics page
        moderation/             # Disputed review moderation
        verifications/          # Sanitary book verification queue
    api/
      cron/
        publish-reviews/        # POST — publishes due reviews + syncs trust scores
        retry-notifications/    # POST — retries failed WA/SMS sends (hourly)
      jobs/                     # Job posts (CRUD), applications, GeoJSON
        applications/           # Application lifecycle (PATCH status transitions)
      reviews/                  # Review submission (WAITER_TO_VENUE, VENUE_TO_WAITER)
        guest/                  # POST — unauthenticated guest reviews (GUEST_TO_VENUE | GUEST_TO_WAITER)
        [id]/                   # PATCH — venue owner approve/reject PENDING reviews
      venues/                   # Venue CRUD, GeoJSON, images
        [id]/public/            # GET — public venue info + accepted waiters (no auth)
      upload/                   # POST — Cloudinary image upload (avatar, venue-photo)
      invites/                  # Job invites: send (owner), respond (waiter)
      shifts/                   # Shift scheduling, marketplace, templates
        [id]/clockin/           # POST — GPS 3-tier clock-in (auto / grace / pending approval)
        [id]/clockout/          # POST — clock-out with early-exit detection
        [id]/claim/             # POST — marketplace claim (WAITER)
        [id]/swap/              # POST — initiate swap request
        assignments/[id]/approve-clockin/  # PATCH — owner approves/rejects pending clock-in
        swaps/[swapId]/         # PATCH — owner approves/rejects swap
        templates/              # Shift template CRUD + bulk generation
      passport/                 # Waiter passport read/write, engagements
        share/                  # POST — generate 30-day share link
        public/[shareToken]/    # GET — public passport view (no auth)
      user/
        tour-complete/          # PATCH — mark User.tourCompleted = true
        notification-prefs/     # GET + PATCH — phone, smsOptIn, waOptIn preferences
      waiters/                  # GET — waiter search (VENUE_OWNER, HEADHUNTER)
      headhunter/saved/         # Saved waiter profiles (GET | POST | DELETE)
      insights/market/          # GET — open positions, avg salary, top municipalities
      admin/
        stats/                  # GET — platform analytics (13 parallel queries)
        activity/               # GET — recent 25 events (registrations/payments/reviews/applications)
        leaderboard/            # GET — top waiters + venues by score
        users/[id]/             # GET paginated list; PATCH soft-delete, restore, role change
        health/                 # GET — system health (overdue reviews, stale subs, cron proxies)
        reviews/                # GET DISPUTED; PATCH publish/remove
        venues/[id]/            # DELETE — GDPR hard-delete
        zones/                  # Zone CRUD (public read, admin write)
      verification/
        sanitary/               # Submit (waiter) + approve/reject (admin)
      notifications/            # GET + PATCH mark-read
      push/subscribe/           # POST — register Web Push subscription
      auth/                     # NextAuth + registration
  components/
    venue/             # VenueCard, VenueInsightsBadge
    job/               # JobCard, JobPostForm, RedAlertBadge
    review/            # ReviewWizard, GuestReviewForm (requires geolocation)
    passport/          # PassportCard, EngagementTimeline, SkillBadges
    trust-score/       # TrustRadar (Recharts radar chart)
    map/               # MapSearch, RedAlertPulse marker
    admin/             # ZoneRow, ZoneForm
    layout/            # DashboardShell, RoleGuard, Navbar
    providers/         # LanguageProvider (i18n context, localStorage persistence)
    ui/                # Radix-based primitives, ImageUpload, NotificationBell,
                       # NotificationsSection, FAQAccordion, FlagSwitcher, NavAuthButton
  hooks/
    useDashboardTour.ts  # driver.js first-login tour; returns { startTour } for manual re-trigger
  lib/
    i18n.ts            # Lang type, FLAGS array (inline SVG), translation map (sr/en/ru)
    auth.ts            # NextAuth config (authOptions + in-process token revocation cache)
    auth-helpers.ts    # verifyCredentials, buildJwtToken, checkLoginRateLimit
    db.ts              # Prisma client (soft-delete filtered) + dbRaw
    cloudinary.ts      # Cloudinary v2 client (used by /api/upload)
    trust-score.ts     # Bayesian scoring — calculatePassportScore, calculateVenueTrustScore
    geofence.ts        # Haversine + isInsideVenueRadius(), parseGuestCoordinates()
    sync-scores.ts     # publishDueReviews, syncVenueTrustScore, syncPassportScore
    side-effects.ts    # fireSideEffects() — fire-and-forget score syncs + notifications
    shift-auth.ts      # canManageShifts, getManagedShift, getManagedTemplate
    shift-utils.ts     # computeScheduledStart, computeScheduledEnd
    rate-limit.ts      # rateLimit() (AnonRateLimit, pre-auth) + checkRateLimit() (RateLimit, post-auth)
    analytics.ts       # Zone insight cache: getVenueZoneInsights, refreshVenueZoneCache
    notify.ts          # Unified notification dispatch (DB + push + WhatsApp + SMS)
    webpush.ts         # Web Push (VAPID) sender
    whatsapp.ts        # WhatsApp Business API sender
    sms.ts             # Infobip SMS sender
    monri.ts           # Monri payment gateway client
    passport-tier.ts   # getEffectiveTier, isPro, isProPlus, tierRank — canonical tier resolution
    subscription-constants.ts  # SUBSCRIPTION_DURATION_MS (30d), RED_ALERT_DELAY_MS (30min)
    format-utils.ts    # getInitials, formatSalary — pure formatting, no project imports
    display-maps.ts    # VERIFICATION_TIER_COLORS, PASSPORT_TIER_COLORS, APPLICATION_STATUS_* etc.
    parse-body.ts      # parseBody / parseQuery — Zod-validated request parsing
    with-role.ts       # withRole / withAuth — session auth + role check wrappers
    audit.ts           # logAudit() — fire-and-forget AuditLog write
    logger.ts          # pino logger (pretty-print dev, JSON prod)
    email.ts           # nodemailer SMTP — sendPasswordResetEmail, sendNotificationEmail
    env.ts             # Validates required env vars at startup (imported by auth.ts)
    utils.ts           # cn() — clsx + tailwind-merge
    __tests__/         # Unit tests for trust-score, geofence, sync-scores, notify (pure functions)
  design-system/
    tokens.ts          # Color palette and design tokens
prisma/
  schema.prisma        # Database schema
  seed.ts              # Demo data
```

## User Roles

| Role | Description |
|---|---|
| `WAITER` | Digital passport, engagement history, skills, ratings |
| `VENUE_OWNER` | Venue profile, job posts, staff verification |
| `HEADHUNTER` | Advanced search of verified talent |
| `ADMIN` | Moderation, sanitary book verification, zone analytics |
| `GUEST` | Can leave geofenced reviews for waiters or venues (no account required) |

## Key Features

- **Role-Specific Landing Pages** — `/for-venues` (venue owner B2B funnel with demo form) and `/for-waiters` (Passport™ feature showcase). Each has its own in-page anchor nav. The root `/` route is a role-picker preloader with SR/EN/RU language switcher (inline SVG flags, `LanguageProvider` context).
- **Session-Aware Nav** — `NavAuthButton` component swaps "Prijava" → role-based "Dashboard →" link when the user is already authenticated. Used on both landing pages.
- **First-Login Guided Tour** — `driver.js` tour fires automatically on first venue-owner login (`User.tourCompleted`). Re-triggerable via "Vodič" button on the Pregled section. Mobile-aware: auto-opens sidebar drawer before starting. `tourCompleted` is carried in the JWT — no extra DB call at runtime.
- **Waiter Passport** — Portable reputation profile with Bayesian trust score, engagement history, skill badges, and a 30-day shareable link (`/passport/[shareToken]`)
- **Free for waiters** — There is no paid waiter tier. Passport, verification, search placement, and every notification channel are free; search rank is earned by trust score alone and cannot be bought. Venues pay commission only.
- **Job Posts** — Venue owners post shifts with mandatory transparency fields (tip system, sanitary requirement, engagement type)
- **Red Alert** — Urgent shifts pulse on the map with a highlighted marker; indexed for fast queries. Signed-in users see Red Alert posts immediately; anonymous callers see them after a 30-minute delay (enforced at query level, so the public map can't be scraped for fresh posts)
- **Geofenced Guest Reviews** — QR code at the table opens a 3-choice flow: review the venue (GUEST_TO_VENUE), a specific waiter (GUEST_TO_WAITER), or both. No auth required; GPS-geofenced within 150m. Venue owners receive a `REVIEW_RECEIVED` notification and can approve or reject PENDING reviews before auto-publish
- **Shift Scheduling** — Full shift lifecycle: create → marketplace claim → GPS clock-in with 3-tier geofence (50m auto, 50–150m grace, >150m manager approval) → clock-out with early-exit detection → swap requests with owner approval
- **Shift Templates** — Recurring shift patterns with bulk generation (up to 90 days). Supports specific day-of-week or weekdays-only mode
- **Verification** — Records *which evidence* was checked, not a rank: SILVER (employment contract), GOLD (venue invite code), ID_VERIFIED (document, ×1.2 score weight). Shown as a binary "Verifikovan" badge plus the named evidence — never as a metal ladder
- **Sanitary Book** — Waiters upload a sanitary certificate; admin approves/rejects; syncs `sanitaryBookValid` flag on passport; venue owners can filter by it
- **Invites** — Venue owners send targeted job invites to waiters (rate-limited, 7-day expiry); waiters accept or decline
- **Waiter Search** — VENUE_OWNER and HEADHUNTER can filter by score, availability, sanitary book, verification, skills, languages, and experience; results ranked by trust score
- **Headhunter Tools** — Save waiter profiles with notes; enriched passport data returned
- **Zone Analytics** — Admin-managed map zones (FESTIVAL_ZONE, TRANSIT_HUB, DEVELOPMENT, …) with projected growth %. Venue zone insights cached as JSON on the Venue model
- **Market Insights** — Aggregate stats: open positions, red alert count, average salary range, top municipalities
- **Dark Dashboard Theme** — Both venue-owner and waiter dashboards use a deep `#120a00` background with an orange-brown grid overlay and a mouse-following radial spotlight rendered via `useRef` (no re-renders). Sidebar and mobile drawer match (`#0e0700` + grid). The `.dark-sidebar` CSS class overrides `.nav-item` colors without touching light-mode pages
- **3-Layer Notifications** — In-app bell with desktop dropdown + mobile bottom sheet (30s polling + Web Push), WhatsApp Business API, and Infobip SMS. All three are opt-in and free to every user. Full notifications page with day-grouped feed and type filter chips (`NotificationsSection`)
- **Admin Dashboard** — Dark-themed admin panel with real-time platform analytics (users by role, passport/venue/job/review counts), live activity feed, system health panel (overdue reviews, cron proxy timestamps, pending clock-ins), and full user management (`/admin/users`) with search, role filter, pagination, soft-delete, and restore
- **Admin Moderation** — Disputed review queue with publish/remove actions; GDPR hard-delete for venues
- **Image Uploads** — Waiter avatars (400×400 face-crop), venue photos (up to 8, 1200×800 fill), and venue logo (circle avatar shown in sidebar and top bar); all on Cloudinary

## Cron Jobs

`POST /api/cron/publish-reviews` — publishes PENDING reviews past their embargo window and syncs affected trust scores. Requires `Authorization: Bearer <CRON_SECRET>` header.

Trigger with any HTTP scheduler. On Vercel, add to `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/publish-reviews",      "schedule": "*/15 * * * *" },
    { "path": "/api/cron/retry-notifications",  "schedule": "0 * * * *"   },
    { "path": "/api/cron/leave-rollover",       "schedule": "0 3 * * *"   }
  ]
}
```

`POST /api/cron/leave-rollover` — opens the new leave year for every active staff
member and expires carry-over days left unused past each venue's
`carryOverDeadline`. Safe to run daily: opening a year is a no-op once the
balance exists, and expiry only touches days that are still unused. Running it
daily rather than annually also means a venue that changes its deadline mid-year
is honoured without a manual trigger.
