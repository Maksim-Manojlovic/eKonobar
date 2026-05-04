# eKonobar

A verified platform for the hospitality sector in Serbia. Waiters get a portable digital reputation passport, venue owners find and verify staff quickly, and headhunters get advanced talent search tools.

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Database:** PostgreSQL 15 via Prisma ORM
- **Auth:** NextAuth.js v4 (JWT sessions)
- **Maps:** Mapbox GL + react-map-gl v8
- **Charts:** Recharts
- **UI:** Radix UI primitives, Tailwind CSS, lucide-react
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
```

Optional:

```env
CRON_SECRET="your-cron-secret"        # required to call /api/cron/* routes
DEFAULT_REVIEW_RADIUS_KM=0.15
ALERT_WEBHOOK_URL=""
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
    (public)/          # Landing, venue listings, job listings, public passport
    (auth)/            # Login, register, onboarding (waiter | venue | headhunter)
    (dashboard)/       # Waiter, venue owner, headhunter, admin dashboards
    api/
      cron/
        publish-reviews/  # POST/GET — publishes due reviews + syncs trust scores
      jobs/              # Job posts and applications
      reviews/           # Review submission and retrieval
      venues/            # Venue CRUD and GeoJSON
      invites/           # Job invites
      shifts/            # Shift scheduling
      passport/          # Waiter passport and engagements
      waiters/           # Waiter search (headhunter)
      headhunter/        # Saved profiles
      admin/             # Moderation, zones, venue management
      verification/      # Sanitary book upload and approval
      auth/              # NextAuth + registration
  components/
    venue/             # VenueCard, VenueInsightsBadge
    job/               # JobCard, JobPostForm, RedAlertBadge
    review/            # ReviewWizard, GuestReviewForm (requires geolocation)
    passport/          # PassportCard, EngagementTimeline, SkillBadges
    trust-score/       # TrustRadar (Recharts radar chart)
    map/               # MapSearch, RedAlertPulse marker
    admin/             # ZoneRow, ZoneForm
    layout/            # DashboardShell, RoleGuard, Navbar
    ui/                # Radix-based primitives
  lib/
    auth.ts            # NextAuth config
    db.ts              # Prisma client (soft-delete filtered) + dbRaw
    trust-score.ts     # Bayesian scoring
    geofence.ts        # Haversine + isInsideVenueRadius()
    sync-scores.ts     # publishDueReviews, syncVenueTrustScore, syncPassportScore
    rate-limit.ts      # In-memory (pre-auth) + DB-backed (post-auth) rate limiter
    __tests__/         # Unit tests for trust-score and geofence
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
| `GUEST` | Can leave geofenced reviews for waiters |

## Key Features

- **Waiter Passport** — Portable reputation profile with Bayesian trust score, engagement history, skill badges, and a shareable link
- **Job Posts** — Venue owners post shifts with mandatory transparency fields (tip system, sanitary requirement, engagement type)
- **Red Alert** — Urgent shifts pulse on the map with a highlighted marker
- **Geofenced Guest Reviews** — Guests can only review a waiter if they are within 150m of the venue
- **Verification Tiers** — UNVERIFIED → SILVER (employment contract) → GOLD (venue invite code) → ID_VERIFIED (document, ×1.2 score weight)
- **Sanitary Book** — Waiters upload a sanitary certificate; admin approves; venue owners can filter by it

## Cron Jobs

`POST /api/cron/publish-reviews` — publishes PENDING reviews past their embargo window and syncs affected trust scores. Requires `Authorization: Bearer <CRON_SECRET>` header.

Trigger every 15 minutes with any HTTP scheduler. On Vercel, add to `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/publish-reviews", "schedule": "*/15 * * * *" }]
}
```
