# eKonobar Mobile — Implementation Plan

Target: one native app (iOS + Android) built with Expo, reusing the existing Next.js backend, database, credentials and business logic. Web app stays live and unchanged in behaviour.

Status: **Phase 0a + 0b done** (monorepo, `@ekonobar/shared` populated), **Phase 1a done** (bearer auth), **Phase 2 done** (native push). Design prototype is in hand (section 15). Next: **Phase 3** (mobile-shaped endpoints) or **Phase 4** (Expo app skeleton). **Phase 1b** (native OAuth) still outstanding.

---

## 1. Locked decisions

| Question | Decision |
|---|---|
| Approach | Expo / React Native, real native app |
| Repo layout | Monorepo in this repo (npm workspaces + Turborepo) |
| Auth | New `/api/mobile/auth/*` bearer-token endpoints; same `User` table, same bcrypt hashes, same roles |
| Roles in v1 | `WAITER`, `VENUE_OWNER`, `ADMIN` (approvals inbox only). `HEADHUNTER` stays web-only |
| App identity | One binary, role-based tab navigation |
| Native capabilities | Push (APNs + FCM), camera/photo upload, Mapbox map |
| Device location | **Not in v1** |
| Offline | Cached reads (TanStack Query persistence), no write queue |
| Release | TestFlight + Play internal testing, no public store listing yet |
| Capacity | Solo, no hard deadline; every phase ends in something runnable |

---

## 2. What "no location in v1" costs — read this before starting

Three features depend on device coordinates. Each needs an explicit fallback, decided now rather than discovered in Phase 5.

| Feature | Web behaviour today | Mobile v1 behaviour |
|---|---|---|
| Shift clock-in (`POST /api/shifts/[id]/clockin`) | GPS under 50m auto-approve, 50–150m grace, else pending | Sends no coordinates, so the route sets `pendingClockIn: true`, returns 202 and notifies the owner. **Every mobile clock-in needs manager approval.** |
| Guest review geofence (150m) | Browser geolocation on `/review/[venueId]` | Stays web-only. The QR code on the table keeps opening the mobile browser. Nothing to build. |
| Map initial viewport | Centers on user, falls back to Belgrade | Always opens on `DEFAULT_CITY` from `src/lib/geo/cities.ts`. No "center on me" button. |

The clock-in consequence is the significant one: it turns a silent auto-approval into a manual owner action on every single shift. Two ways out, both cheap, both deferrable past v1:

- **QR clock-in.** The venue prints a QR per venue, the app scans it, and it posts `method: "QR"`. `qrcode.react` already generates codes on the web side and the clock-in route already accepts `"QR"`. Needs camera permission, which you are shipping anyway for photo upload. This is the recommended fix and is roughly one screen.
- **Turn location back on later.** `expo-location` with while-in-use permission is about a day of work and changes no server code.

Flagged here so the owner-side approve-clock-in screen is treated as load-bearing in Phase 6, not optional.

---

## 3. Hard external constraints

- **You are on Windows.** iOS builds cannot run locally — there is no workaround. All iOS builds go through **EAS Build** (Expo's cloud macOS builders). Android can build locally or on EAS.
- **TestFlight requires a paid Apple Developer Program membership** (99 USD/yr). "Internal beta only" does not exempt you. For a company account this needs a D-U-N-S number and entity verification, which historically takes one to four weeks. Start this during Phase 0 — it is the longest-lead item in the plan and it blocks nothing else, so it should run in the background from day one.
- **Google Play internal testing** requires a Play Console account (25 USD one-time). The 12-testers-for-14-days rule applies to production access for new personal accounts, not to internal testing tracks, so it does not block a beta.
- **Expo Go will not work** for this app. `@rnmapbox/maps` and native push both need custom native code, so test devices need an **EAS development build** from Phase 4 onward.

---

## 4. Phase 0 — Monorepo restructure

Goal: `apps/web` and `apps/mobile` coexist and both build. No behaviour change to the web app.

Split into two commits so each is independently verifiable:

- **0a — layout only (done).** Move the app under `apps/web`, stand up workspaces + Turborepo, scaffold empty `packages/shared` and `packages/api-client`, fix every config and the Docker build. No source file changes beyond import paths in the Prisma seeds.
- **0b — populate `packages/shared` (done).** Move the framework-free modules listed below out of `apps/web/src` and update their importers. Deliberately separated: 0a touches ~20 config files and zero application logic, 0b touches application logic across many files, and mixing them would make a regression impossible to bisect.

  0b is now **deferred behind Phase 1** rather than done next. Nothing consumes `packages/shared` yet, so moving code into it today is a large diff guessing at what the mobile app will need. Doing it per-module as Phases 4–8 actually reach for each one keeps every move small and justified. The scaffold and its rules are already in place, which is the part that had to happen during the restructure.

### Target layout

```
ekonobar/
  package.json            # workspaces root, turbo
  turbo.json
  prisma/                 # stays at root — single schema, single migration history
  apps/
    web/                  # everything currently in src/, public/, next.config.ts, ...
    mobile/               # new Expo app
  packages/
    shared/               # framework-free code both apps import
    api-client/           # typed fetch layer + token refresh
```

### What moves into `packages/shared`

Only code with zero Next.js and zero Node-only imports. Audit each file before moving it.

| From | Notes |
|---|---|
| `src/lib/formatting/utils.ts` | Pure. Moves as-is. |
| `src/lib/formatting/display-maps.ts` | Labels move cleanly. **Tailwind class strings do not apply to React Native** — split into `labels.ts` (shared) and `colors.web.ts` (stays in web), plus `colors.native.ts` mapping the same keys to hex values from the design tokens. |
| `src/lib/geo/municipalities.ts`, `cities.ts` | Pure constants. |
| `src/lib/geo/bbox.ts` | `stableJitter` and `BBoxSchema` are pure; Zod works in RN. |
| `src/lib/i18n/index.ts` | The translation map is pure data. `LanguageProvider` stays per-app — different storage (`localStorage` vs `AsyncStorage`). |
| `src/design-system/tokens.ts` | Already exists. Becomes the single source for both the Tailwind config and the RN theme. |
| Zod request/response schemas | Currently declared inline in each route file. Extract per route into `packages/shared/schemas/*.ts` and import them back into the routes. This is the highest-value part of the move — it is what stops mobile and server from drifting. |

### Enums — do not import `@prisma/client` in the mobile app

`@prisma/client` pulls a Node runtime and will not bundle into React Native.

- **Type-only imports** (`import type { Role } from "@prisma/client"`) are erased at compile time and are safe.
- **Runtime enum values** are not — `Object.values(VenueType)` is used by the seed and the display maps. Declare them once in `packages/shared/enums.ts` as `as const` objects, and add a unit test asserting they match the Prisma enums exactly. That is the same guard pattern `display-maps.test.ts` already uses for `VENUE_TYPE_LABELS`.

### What breaks and needs fixing in this phase

- **`.env` resolution — the one that actually bites.** A single `.env` stays at the repo root (Prisma reads it natively; two env files would drift). Next.js only looks in its own directory, and it loads and *caches* an empty result for `apps/web` before `next.config.ts` is evaluated — so `loadEnvConfig(root)` without the `forceReload` argument is a silent no-op and `next build` dies in the page-data workers with `Missing required environment variable: DATABASE_URL`. Vitest has the same problem, solved with `envDir`.
- `tsconfig.json` path alias `@/*` — stays `./src/*`, since the config file moves with the app. Workspace packages resolve through the `node_modules/@ekonobar/*` symlinks, so no extra alias is needed.
- `turbo` requires a `packageManager` field in the root `package.json` or it refuses to resolve the workspace.
- Prisma seeds import `../src/lib/...` — re-point to `../apps/web/src/lib/...` (until 0b moves those modules into `packages/shared`).
- `.dockerignore` — a bare `node_modules` entry only matches the root copy; workspace layouts need `**/node_modules` and `**/.next`.
- **Pre-existing: the production Docker build was already broken before any of this.** `.dockerignore` excludes `.env` (correctly), but `next build` collects page data by importing every route module, which runs the `required()` checks in `src/lib/core/env.ts` — so the build has been dying on `Missing required environment variable: DATABASE_URL`. Verified by building the untouched baseline commit `17cd772`: it fails identically at `RUN npm run build`. Fixed here by setting builder-stage-only placeholders for `DATABASE_URL` and `NEXTAUTH_SECRET`; the runner is a separate stage and never inherits them, and neither is a `NEXT_PUBLIC_` var, so neither reaches the client bundle.
- `vitest.config.ts` project roots, and the `@/tests/*` alias the route harness uses.
- `playwright.config.ts` → `webServer.command`.
- `Dockerfile` — the `output: "standalone"` build copies from `.next/standalone`; that path changes under a workspace, and hoisted `node_modules` means the standalone bundle must also include `packages/*`. Verify the container still boots before moving on.
- `.github/workflows/*` — working directories.
- `scripts/vercel-build.sh`, `scripts/check-observability.mjs` — path assumptions.
- Root `package.json` prisma scripts — the schema stays at root, so most survive.

### Exit criteria

`npm run build`, `npm test`, `npm run lint` and `docker compose -f docker-compose.prod.yml build` all pass from the repo root, with the web app behaviourally identical.

---

## 5. Phase 1 — Backend: bearer-token auth

Goal: every one of the ~74 existing API routes accepts a mobile bearer token **without being individually edited**.

### Schema addition

```prisma
model MobileRefreshToken {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  tokenHash  String   @unique          // sha256 of the opaque token — never store the raw value
  deviceId   String                    // stable per-install id from the client
  deviceName String?                   // "iPhone 13" — for a future active-sessions screen
  platform   String                    // "ios" | "android"

  expiresAt  DateTime
  revokedAt  DateTime?
  lastUsedAt DateTime @default(now())
  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}
```

### New routes

| Route | Auth | Behaviour |
|---|---|---|
| `POST /api/mobile/auth/login` | public | `{ email, password, deviceId, deviceName, platform }`. Reuses `checkLoginRateLimit(ip, email)` and `verifyCredentials` from `lib/auth/helpers.ts` verbatim — same two rate limits, same bcrypt. Returns `{ accessToken, refreshToken, user }`. |
| `POST /api/mobile/auth/refresh` | public | Rotating refresh: validates the hash, revokes the old row, issues a new pair. A reused revoked token revokes the whole device chain (theft detection). |
| `POST /api/mobile/auth/logout` | public | Revokes the presented refresh token. Idempotent. |
| `POST /api/mobile/auth/oauth` | public | **Not built — phase 1b.** `{ provider: "google" or "facebook", idToken }`. Verifies the id_token with the provider, upserts `User` + `Account` the way `PrismaAdapter` would, then issues the token pair. Deferred because it needs a provider-verification dependency and its own decisions (JWKS caching, the same-email collision that account linking does not handle today); credentials login unblocks the whole app in the meantime. |
| `GET /api/mobile/me` | bearer | Current user + role + verification tier. Called on cold start to validate a stored token. |

### Access token — reuse the NextAuth JWT shape

Do not invent a second token format. `next-auth/jwt` exports `encode`/`decode`; sign the access token with `NEXTAUTH_SECRET` and the exact payload `buildJwtToken()` already produces. Then `buildSessionUser(token)` and `isTokenRevoked()` work unchanged, and an ADMIN mobile token gets the same 5-second revocation cache TTL an ADMIN web token gets.

```ts
// apps/web/src/lib/auth/bearer.ts  (new)
import { decode } from "next-auth/jwt";
import { buildSessionUser } from "./helpers";
import { isTokenRevoked } from "./revocation";

export async function getBearerSession(req: NextRequest): Promise<Session | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = await decode({ token: header.slice(7), secret: process.env.NEXTAUTH_SECRET! });
  if (!token?.id || typeof token.iat !== "number") return null;

  if (await isTokenRevoked(token.id as string, token.iat, token.role as string | undefined)) {
    return null;
  }

  return {
    user: buildSessionUser(token),
    expires: new Date((token.exp as number) * 1000).toISOString(),
  } as Session;
}
```

Access token TTL: **15 minutes**. Refresh token TTL: **60 days**, rotating on every use.

### The two edits that make all 74 routes work

**1. `lib/auth/with-role.ts`** — one line in each of the three wrappers:

```ts
const session = (await getBearerSession(req)) ?? (await getServerSession(authOptions));
```

`withRole`, `withAuth` and `withOptionalAuth` all inherit it. No route file changes.

**2. `src/middleware.ts`** — the middleware runs on the Edge runtime and currently 401s any `/api/*` request without a NextAuth cookie, which would kill every mobile call before the handler ran. It has to let bearer requests through and leave real verification to the Node-side wrapper:

```ts
if (pathname.startsWith("/api/")) {
  const hasBearer = req.headers.get("authorization")?.startsWith("Bearer ") ?? false;
  if (!isPublicApiRoute(pathname) && !token && !hasBearer) {
    return withTrace(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  return passThrough();
}
```

This is deliberately not a verification — the middleware only stops obviously anonymous traffic, exactly as it does today. A forged `Authorization` header gets past the middleware and is then rejected by `withRole` with a 401, which is the same outcome as now. Also add `/api/mobile/auth/` to `PUBLIC_API_PATTERNS`.

### Security notes

- Refresh tokens are opaque 32-byte random values, stored **hashed** (sha256). A database leak must not yield usable sessions.
- The client stores both tokens in `expo-secure-store` (Keychain / Android Keystore), never `AsyncStorage`.
- `POST /api/mobile/auth/login` gets the same IP and email rate limits as the web login — reuse `checkLoginRateLimit`, do not write a second one.
- Refresh rotation with reuse detection: if a revoked refresh token is presented, revoke every `MobileRefreshToken` for that `deviceId`. That is the standard mitigation for a stolen refresh token.
- The existing `TokenRevocation` table covers logout-everywhere for both clients at once, for free.

### Tests

- Unit: `getBearerSession` — valid, expired, malformed, revoked, missing header.
- Unit: refresh rotation, reuse detection, expiry.
- Integration: login, then call `GET /api/shifts` with the bearer → 200; same call with no header → 401; wrong-role bearer → 403.
- Regression: the existing web route tests must pass untouched. If any break, the wrapper change was wrong.

---

## 6. Phase 2 — Backend: native push

Web push (VAPID) does not reach a native app. Add a parallel channel and keep the existing one for the web.

### Schema

```prisma
model DeviceToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  token     String   @unique     // Expo push token: ExponentPushToken[...]
  platform  String                // "ios" | "android"
  deviceId  String

  createdAt  DateTime @default(now())
  lastSeenAt DateTime @default(now())

  @@index([userId])
}
```

### Provider: Expo Push Service

Expo's service fronts both APNs and FCM behind one HTTP call and one token format. It is free, and it keeps APNs `.p8` keys and FCM credentials out of application code — they are uploaded once to the Expo project. For a solo build this is clearly the right call; a direct APNs/FCM integration is a later optimisation, not a launch requirement.

### Code changes

- `lib/integrations/expo-push.ts` (new) — `sendExpoPush(tokens, payload)`. Batches to 100 per request (Expo's cap), reads the receipt endpoint, and deletes tokens that come back `DeviceNotRegistered` — mirroring how `dispatchPush` already deletes `410`/`404` web subs.
- `lib/notifications/dispatch.ts` — add `dispatchDevicePush(tokens, payload)` beside `dispatchPush`. Same contract: network only, returns a boolean, no DB writes.
- `lib/notifications/notify.ts` — fetch `DeviceToken` rows alongside `PushSubscription`, dispatch both, and fold the result into the existing single batched `db.notification.update`. Add a `devicePushSent` column so the retry cron can see it.
- `POST /api/mobile/push/register` and `DELETE /api/mobile/push/unregister` — bearer-authed, upsert/delete on `token`. Both must call `bustNotifyPrefsCache(userId)`, exactly as the web subscribe route does.
- `lib/notifications/retry.ts` and `POST /api/cron/retry-notifications` — add the device-push channel to the retry sweep.

All eleven `NotificationType` values already route through `notify()`, so every existing notification reaches the phone with no per-callsite change.

### Deep links

Notification payloads already carry `link` (e.g. `/dashboard/venue`). Map those to `expo-router` paths in one table inside the app so a tapped push lands on the right screen. Do not change the server-side link strings — the web depends on them.

---

## 7. Phase 3 — Backend: mobile-shaped endpoints

Small phase. Add only what a phone genuinely needs and the web does not.

- `GET /api/mobile/bootstrap` — one call returning user, role, unread notification count, and the role's headline counters. Cold start on mobile data should be one round trip, not six.
- **Pagination audit.** `GET /api/waiters` caps at 100 and `GET /api/notifications` returns a full list. On a phone these need cursor pagination. Add `?cursor=&limit=` to `notifications`, `jobs` and `reviews`, defaulting to today's behaviour so the web is unaffected.
- **Payload trimming.** Check the heaviest responses (`GET /api/shifts?view=manage`, `GET /api/venues/[id]`) and add a leaner mobile shape only if they measure large. Measure before optimising.
- **No CORS work needed.** Native fetch sends no `Origin`, so the existing same-origin setup is fine. The CSP in `next.config.ts` likewise does not apply to native.
- **`/api/upload` works as-is.** React Native `FormData` with `{ uri, name, type }` posts valid multipart to the existing Cloudinary route. No server change.

---

## 8. Phase 4 — Expo app skeleton

| Concern | Choice |
|---|---|
| Framework | Expo SDK (latest stable) with `expo-router` — file-based, mirrors the App Router mental model |
| Data | TanStack Query + `@tanstack/query-async-storage-persister` for the cached-read requirement |
| Auth storage | `expo-secure-store` |
| Styling | `nativewind` (Tailwind syntax for RN) so `src/design-system/tokens.ts` drives both apps |
| Forms | `react-hook-form` + the shared Zod schemas |
| Icons | `lucide-react-native` — same icon set as the web |
| Map | `@rnmapbox/maps` |
| Push | `expo-notifications` |
| Camera | `expo-image-picker` |

Build in this order:

1. Expo app boots and an EAS development build installs on a real device.
2. `packages/api-client` — typed fetch with an interceptor that refreshes once on 401, queues concurrent requests during the refresh, and signs out on refresh failure. This is the single most important file in the mobile app; write its tests first.
3. Auth screens: login, register, forgot password, Google, Facebook. Reuses the `login` / `register` / `resetPassword` i18n namespaces already translated to sr/en/ru.
4. Role-based tab shell — read `role` from the session and render the matching tab set.
5. Language switcher wired to the shared translation map.

---

## 9. Phase 5 — Waiter screens

Mapped to existing endpoints. No new backend work.

| Screen | Endpoints |
|---|---|
| Pregled (home) | `GET /api/mobile/bootstrap`, `GET /api/shifts` |
| Poslovi (feed + filters) | `GET /api/jobs`, `GET /api/insights/market` |
| Job detail + apply | `GET /api/jobs/[id]`, `POST /api/jobs/applications` |
| Moje prijave | `GET /api/jobs/applications`, `PATCH /api/jobs/applications/[id]` (withdraw) |
| Smene | `GET /api/shifts`, `POST /api/shifts/[id]/claim`, `/clockin`, `/clockout`, `/swap` |
| Pasoš | `GET /api/passport`, `PUT /api/passport`, `POST /api/passport/share` |
| Sanitarna knjižica | `POST /api/upload` then `POST /api/verification/sanitary` |
| Pozivnice | `GET /api/invites`, `PATCH /api/invites/[id]` |
| Recenzije | `GET /api/reviews` |
| Odmori | `GET/POST /api/leave/requests`, `GET /api/leave/balance` |
| Obaveštenja | `GET /api/notifications`, `PATCH /api/notifications` |
| Podešavanja | `GET/PATCH /api/user/notification-prefs`, `POST /api/mobile/push/register` |

Clock-in on the Smene screen always produces the pending-approval state — see section 2.

---

## 10. Phase 6 — Venue owner screens

| Screen | Endpoints |
|---|---|
| Pregled | `GET /api/mobile/bootstrap` |
| Oglasi (list, create, Red Alert) | `GET/POST /api/jobs`, `PATCH /api/jobs/[id]` |
| Prijave (triage) | `GET /api/jobs/applications`, `PATCH /api/jobs/applications/[id]` |
| Smene | `GET /api/shifts?view=manage`, `POST /api/shifts`, templates |
| **Odobrenja dolaska** | `PATCH /api/shifts/assignments/[id]/approve-clockin` — load-bearing in v1 |
| Zamene | `PATCH /api/shifts/swaps/[swapId]` |
| Ekipa | `GET /api/venues/[id]/staff`, `.../staff/[staffId]` |
| Recenzije | `GET /api/venues/[id]/reviews`, `PATCH /api/reviews/[id]` |
| Pronađi konobara | `GET /api/waiters`, `GET /api/waiters/coverage`, `POST /api/invites` |
| Profil lokala | `PATCH /api/venues/[id]`, `POST /api/upload` |

The shift scheduling grid is the hardest screen to fit on a phone. Recommendation: mobile gets a **day/agenda list**; the week grid stays a web affordance.

---

## 11. Phase 7 — Admin approvals inbox

Three screens only.

| Screen | Endpoints |
|---|---|
| Verifikacije | `GET /api/verification/sanitary`, `PATCH /api/verification/sanitary/[id]` |
| Sporne recenzije | `GET /api/admin/reviews`, `PATCH /api/admin/reviews/[id]` |
| Zdravlje sistema | `GET /api/admin/health` |

No charts, no tables, no user management — those stay on the web dashboard. `recharts` has no React Native build and nothing here needs it.

---

## 12. Phase 8 — Map

`@rnmapbox/maps` against the existing `/api/venues/geojson` and `/api/jobs/geojson`, both unchanged.

- Clustering: `use-supercluster` is React-DOM-agnostic and might port, but `@rnmapbox/maps` has **native clustering** built into `ShapeSource` — prefer the native path, it is faster and less code.
- Viewport opens on `DEFAULT_CITY`. Filters go in the query string, never post-filtered on the response — the `MAX_FEATURES` cap makes client-side filtering silently wrong. That rule is in `CLAUDE.md` and applies identically on mobile.
- Requires a Mapbox **downloads token** in addition to the public access token, stored as an EAS secret.

---

## 13. Phase 9 — Build, release, operate

- **EAS Build** profiles: `development` (dev client), `preview` (internal-distribution APK / ad-hoc IPA), `production` (store builds).
- **EAS Submit** to TestFlight (iOS) and Play internal testing (Android).
- **EAS Update** for OTA JS-only fixes; native changes still need a store build.
- **Sentry** — `@sentry/react-native` in the same org/project family as the web `@sentry/nextjs`, so a mobile error and its server request share a trace. The mobile API client should surface the `x-request-id` the middleware already stamps and attach it to Sentry events.
- **Environment** — `EXPO_PUBLIC_API_URL` points at the production domain; add a build-time switch for a staging backend.
- **App Store privacy labels** — you collect name, email, phone and photos. Precise location is *not* collected in v1, which materially simplifies the questionnaire. Declare it accurately.

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| Apple Developer enrollment blocks TestFlight for weeks | Start enrollment during Phase 0, before any code |
| Monorepo restructure breaks the Docker production build | Phase 0 exit criteria include a successful `docker compose build` and a container boot check |
| Bearer change weakens web auth | The wrapper falls back to `getServerSession` unchanged; the full existing route test suite must pass untouched before Phase 1 is done |
| Clock-in without GPS floods owners with approvals | Ship QR clock-in in v1.1, or re-enable `expo-location` |
| Shared package drifts from the Prisma enums | `as const` enums plus a test asserting equality with the Prisma enums |
| Windows dev machine cannot build iOS | All iOS builds via EAS cloud from day one — verify the pipeline in Phase 4, not at release |

---

## 15. The design prototype

Lives in `design/` — **gitignored on purpose**: it is a React-over-CDN HTML prototype regenerated wholesale on each design pass, not the source of truth for shipped code. Open `design/eKonobar iOS App.html` in a browser to run it.

```
design/
  eKonobar iOS App.html   entry point
  ios-frame.jsx           iOS 26 device frame, status bar, keyboard
  tweaks-panel.jsx        prototype-only tweak controls (not shipped)
  ui.jsx                  Icon set, Avatar, Pill, Card, ScoreRing, Stars, buttons
  ui-dark.jsx             dark shell: DarkTabBar, DarkTopBar, SegmentTabs, CalendarMonth
  data.jsx, data-brief.jsx   mock data
  screens-auth.jsx        Welcome / Login / Register
  screens-shared.jsx      Notifications, Settings
  screens-waiter*.jsx     waiter screens (the *2 / *3 files supersede the light-theme first draft)
  screens-owner*.jsx      owner screens (same)
  app.jsx                 root: which screens are actually wired
```

`app.jsx` is the inventory that matters — several screens in `screens-waiter.jsx` and `screens-owner.jsx` are a superseded light-theme draft and are not reachable. Build from what `app.jsx` renders.

### Design tokens — already match the web

| Token | Value | Same as web? |
|---|---|---|
| Shell background | `#120a00` | yes — the dashboard dark theme |
| Tab bar / sidebar | `#0e0700` | yes |
| Accent | `#f97316` | yes |
| Cards | white `#fff`, radius 18, border `#f0efec` | yes — white `dash-card` on dark ground |
| Font | Lexend | yes |

So no new palette. `src/design-system/tokens.ts` can drive both apps, as Phase 0b assumes.

### Tab sets (from `WAITER_TABS2` / `OWNER_TABS2`)

- **Waiter:** Pregled · Poslovi · Smene · Recenzije · Passport
- **Owner:** Pregled · Posao · Smene · Recenzije · Profil

Admin has no design. Its three approval screens (section 11) get built from the same primitives.

### Where the design and the backend disagree

Resolved in favour of the codebase. The prototype was drawn against an older model of the product.

| Prototype | Reality | Resolution |
|---|---|---|
| `BRONZE → SILVER → GOLD → PLATINUM` ladder; "Gold → Platinum, 127/150" progress bar (`verificationTierMeta`, `tierColor`, `user.tierNext`) | `VerificationTier` is `UNVERIFIED \| SILVER \| GOLD \| ID_VERIFIED`. BRONZE and PLATINUM are not values; UNVERIFIED and ID_VERIFIED have no entry in the design. This is the exact mismapping that used to render the most-verified users as "BRONZE" | Binary `<VerifiedBadge />` + `<VerificationProofChip />` — what the evidence proves, not a rank. Progress bar becomes `NEXT_VERIFICATION_STEP` (the next concrete action) |
| FREE / PRO 290 RSD / PRO+ 490 RSD cards on Passport; WhatsApp "Dostupno uz PRO", SMS "Dostupno uz PRO+" | `PassportTier` does not exist in the schema. Waiter monetization was removed deliberately | Delete the pricing row. WhatsApp and SMS become plain opt-in toggles with no gate and no hint text |
| Settings → "Prebaci na Vlasnik nalog" (switch role) | `POST /api/auth/set-role` 403s for any established user (`role !== "WAITER"` or a passport exists). One role per account | Drop the switcher. The "Nalog vrsta" card comes out of Settings |
| Owner Pregled shows `Pill {user.plan}` = "Pro" | Venues are commission-only; there is no venue plan tier | Drop the plan pill |

### What the design gets right and should be kept

- `ClockInButton` already models `idle → pending ("Čekamo odobrenje…") → checked_in → clocked_out`. That is exactly the no-GPS path from section 2 — the design anticipated it.
- `CalendarMonth` + `DayBrief` is a good answer to the "week grid does not fit a phone" problem in section 10: a month grid with an inline expanding day brief, not a scrolling week.
- `SegmentTabs` inside each tab (Poslovi → Red Alert / Oglasi / Prijave / Pozivnice) keeps five bottom tabs while covering far more surface. Adopt it.
- `StaffingBar` (filled/required with a red→amber→green ramp) maps directly onto `Shift.requiredCount` vs assignment count.

## 16. Still open

Nothing blocking. Phase 1 can start immediately.
