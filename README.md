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
| `npm test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
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
    (auth)/            # Login, register, onboarding (waiter | venue | headhunter)
    (dashboard)/       # Waiter, venue owner, headhunter, admin dashboards
    api/
      cron/
        publish-reviews/     # POST — publishes due reviews + syncs trust scores
      jobs/                  # Job posts (CRUD), applications, GeoJSON
        applications/        # Application lifecycle (PATCH status transitions)
      reviews/               # Review submission (WAITER_TO_VENUE, VENUE_TO_WAITER)
        guest/               # POST — unauthenticated guest reviews (GUEST_TO_VENUE | GUEST_TO_WAITER)
        [id]/                # PATCH — venue owner approve/reject PENDING reviews
      venues/                # Venue CRUD, GeoJSON, images
        [id]/public/         # GET — public venue info + accepted waiters (no auth)
      upload/                # POST — Cloudinary image upload (avatar, venue-photo)
      invites/               # Job invites: send (owner), respond (waiter)
      shifts/                # Shift scheduling, marketplace, templates
        [id]/clockin/        # POST — clock-in (GPS 3-tier: auto / grace / pending approval)
        [id]/clockout/       # POST — clock-out with early-exit detection
        assignments/
          [id]/approve-clockin/ # PATCH — venue owner approves/rejects pending clock-in
        [id]/claim/          # POST — marketplace claim (WAITER)
        [id]/swap/           # POST — initiate swap request
        swaps/[swapId]/      # PATCH — owner approves/rejects swap
        templates/           # Shift template CRUD + bulk generation
      passport/              # Waiter passport read/write, engagements
        share/               # POST — generate 30-day share link
        public/[shareToken]/ # GET — public passport view (no auth)
      user/
        tour-complete/       # PATCH — mark User.tourCompleted = true (called on tour close)
      waiters/               # GET — waiter search (VENUE_OWNER, HEADHUNTER)
      headhunter/saved/      # Saved waiter profiles (GET | POST | DELETE)
      insights/market/       # GET — market stats (open positions, avg salary, top municipalities)
      admin/
        reviews/             # GET DISPUTED reviews; PATCH publish/remove
        venues/[id]/         # DELETE — GDPR hard-delete
        zones/               # Zone CRUD (public read, admin write)
      verification/
        sanitary/            # Sanitary book submit (waiter) + approve/reject (admin)
      notifications/         # GET + PATCH mark-read
      push/subscribe/        # POST — register Web Push subscription
      auth/                  # NextAuth + registration
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
    auth.ts            # NextAuth config
    db.ts              # Prisma client (soft-delete filtered) + dbRaw
    cloudinary.ts      # Cloudinary v2 client (used by /api/upload)
    trust-score.ts     # Bayesian scoring
    geofence.ts        # Haversine + isInsideVenueRadius()
    sync-scores.ts     # publishDueReviews, syncVenueTrustScore, syncPassportScore
    rate-limit.ts      # In-memory (pre-auth) + DB-backed (post-auth) rate limiter
    analytics.ts       # Zone insight cache: getVenueZoneInsights, refreshVenueZoneCache
    notify.ts          # Unified notification dispatch (DB + push + WhatsApp + SMS)
    webpush.ts         # Web Push (VAPID) sender
    whatsapp.ts        # WhatsApp Business API sender
    sms.ts             # Infobip SMS sender
    shift-utils.ts     # computeScheduledStart / computeScheduledEnd helpers
    __tests__/         # Unit tests for trust-score and geofence (pure functions)
  app/api/reviews/[id]/__tests__/  # Route handler tests (vi.mock() pattern)
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
- **Job Posts** — Venue owners post shifts with mandatory transparency fields (tip system, sanitary requirement, engagement type)
- **Red Alert** — Urgent shifts pulse on the map with a highlighted marker; indexed for fast queries
- **Geofenced Guest Reviews** — QR code at the table opens a 3-choice flow: review the venue (GUEST_TO_VENUE), a specific waiter (GUEST_TO_WAITER), or both. No auth required; GPS-geofenced within 150m. Venue owners receive a `REVIEW_RECEIVED` notification and can approve or reject PENDING reviews before auto-publish
- **Shift Scheduling** — Full shift lifecycle: create → marketplace claim → GPS clock-in with 3-tier geofence (50m auto, 50–150m grace, >150m manager approval) → clock-out with early-exit detection → swap requests with owner approval
- **Shift Templates** — Recurring shift patterns with bulk generation (up to 90 days). Supports specific day-of-week or weekdays-only mode
- **Verification Tiers** — UNVERIFIED → SILVER (employment contract) → GOLD (venue invite code) → ID_VERIFIED (document, ×1.2 score weight)
- **Sanitary Book** — Waiters upload a sanitary certificate; admin approves/rejects; syncs `sanitaryBookValid` flag on passport; venue owners can filter by it
- **Invites** — Venue owners send targeted job invites to waiters (rate-limited, 7-day expiry); waiters accept or decline
- **Waiter Search** — VENUE_OWNER and HEADHUNTER can filter by score, availability, sanitary book, verification tier, skills, languages, and experience
- **Headhunter Tools** — Save waiter profiles with notes; enriched passport data returned
- **Zone Analytics** — Admin-managed map zones (FESTIVAL_ZONE, TRANSIT_HUB, DEVELOPMENT, …) with projected growth %. Venue zone insights cached as JSON on the Venue model
- **Market Insights** — Aggregate stats: open positions, red alert count, average salary range, top municipalities
- **Dark Dashboard Theme** — Both venue-owner and waiter dashboards use a deep `#120a00` background with an orange-brown grid overlay and a mouse-following radial spotlight rendered via `useRef` (no re-renders). Sidebar and mobile drawer match (`#0e0700` + grid). The `.dark-sidebar` CSS class overrides `.nav-item` colors without touching light-mode pages
- **3-Layer Notifications** — In-app bell with desktop dropdown + mobile bottom sheet (30s polling + Web Push), WhatsApp Business API (opt-in), Infobip SMS (opt-in). Full notifications page with day-grouped feed and type filter chips (`NotificationsSection`)
- **Admin Moderation** — Disputed review queue with publish/remove actions; GDPR hard-delete for venues
- **Image Uploads** — Waiter avatars (400×400 face-crop), venue photos (up to 8, 1200×800 fill), and venue logo (circle avatar shown in sidebar and top bar); all on Cloudinary

## Cron Jobs

`POST /api/cron/publish-reviews` — publishes PENDING reviews past their embargo window and syncs affected trust scores. Requires `Authorization: Bearer <CRON_SECRET>` header.

Trigger every 15 minutes with any HTTP scheduler. On Vercel, add to `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/publish-reviews", "schedule": "*/15 * * * *" }]
}
```
