# eKonobar — Technical Debt Audit Log

Graph-based code quality audit. Findings sourced from Graphify graph (`graphify-out/`) cross-referenced against current source. Append new findings with incremental IDs (`CQ-<letter>`). Statuses: `[OPEN]` · `[IN PROGRESS]` · `[FIXED]` · `[PARTIALLY FIXED]` · `[FALSE POSITIVE]` · `[WONTFIX]`.

> Note: this project has no prior `RentCheck` audit log. IDs start at `CQ-F` (the originating prompt referenced a RentCheck log ending at `CQ-E`; continued here for traceability).

## Status Table

| ID   | Severity     | Title                                                         | Status            |
| ---- | ------------ | ------------------------------------------------------------- | ----------------- |
| CQ-F | Critical     | Stale Graphify graph poisons graph-based audits               | [FIXED]           |
| CQ-G | Important    | God-components: state-heavy dashboard sections                | [FIXED]           |
| CQ-H | Important    | No data-fetching abstraction (root cause of CQ-G)             | [FIXED]           |
| CQ-I | Important    | Silent error swallowing in API routes + components            | [FIXED]           |
| CQ-J | Nice-to-have | console.\* in lib modules vs logging convention               | [FIXED]           |
| CQ-K | Important    | i18n speculative generality / YAGNI                           | [FIXED]           |
| CQ-L | Nice-to-have | Waiter dashboard spams 403 on /api/shifts?view=manage         | [FIXED]           |
| CQ-M | Important    | CSP worker-src blocks service worker → push dead              | [FIXED]           |
| CQ-N | Important    | Public guest-review page is a 17-useState god-component       | [FIXED]           |
| CQ-O | Nice-to-have | admin/page + ProfileSection still hand-roll fetch (no useApi) | [FIXED]           |
| TEL-A | Important   | Error boundaries never report to Sentry; no global-error.tsx  | [FIXED]           |
| TEL-B | Critical    | No request correlation ID; pino logs uncorrelated with traces | [FIXED]           |
| TEL-C | Important   | Logger has no request-scoped context binding                  | [FIXED]           |
| TEL-D | Important   | No Prisma / DB-tier span instrumentation                      | [FIXED]           |
| TEL-E | Nice-to-have| Golden-signals / saturation coverage incomplete              | [FIXED]           |
| CQ-P | Important    | Waiter-search feature triplicated (3 clients, no shared hook/card)   | [FIXED]    |
| CQ-Q | Important    | jobs/new god-form: 11 scattered field useState (CQ-N not propagated) | [FIXED]    |
| CQ-R | Important    | Headhunter dashboard never modularized (SRP; skipped by CQ-G)        | [FIXED]    |
| CQ-S | Nice-to-have | Server-side bare catch swallow in dispatch.ts (CQ-I recurrence)      | [FIXED]    |
| CQ-T | Nice-to-have | Tier isActive resolution reinlined in leaderboard vs getEffectiveTier | [FIXED]   |
| CQ-U | Important    | Marketing pages bypass components/landing module system (SRP/DRY)    | [OPEN]     |
| CQ-V | Important    | Presentational primitives duplicated (LogoMark ×4, Check icon dupe)  | [OPEN]     |
| CQ-W | Important    | Landing data arrays fused into page bodies (data≠view; vs convention) | [OPEN]    |
| CQ-X | Important    | for-venues #demo lead form is a dead handler (discards submissions)  | [OPEN]     |
| CQ-Y | Nice-to-have | Icon inconsistency: FeatureGrid lucide vs pages hand-inline <svg>    | [OPEN]     |
| DA-D | Important    | Zero tests on (public) landing pages + new leave/team sections       | [OPEN]     |
| DA-E | Important    | register/page.tsx borderline CQ-N/CQ-Q grouped-state recurrence      | [OPEN]     |

---

## Findings

### CQ-F — Stale Graphify graph poisons graph-based audits [FIXED]

Severity: Critical
Problem: graph @ `b9b39df6`, HEAD `cda71e4` (8 commits behind). Deleted flat `lib/*.ts`
files persisted as nodes → phantom god-nodes (`db` x2, `dbRaw` x2), phantom scoring
triplication, phantom `Community 102` (`lib/audit.ts`/`lib/db.ts`/`lib/notify.ts`...).
Fix: ran `graphify update .` → 2935 nodes / 7305 edges / 207 communities, fresh from HEAD.
Follow-up: enforce `graphify update .` in pre-commit / CI so it cannot drift again.
Nodes: `db`(#1,#2), `dbRaw`(#3,#5), Community 7, Community 102.
Resolved: 2026-06-18 — graph refreshed this session.

### CQ-G — God-components: state-heavy dashboard sections [FIXED]

Severity: Important
Problem: section components hoard local state + inline fetching:

- `WaiterPassportSection.tsx` — 26 useState, 12 fetch, 3 useEffect (701 LOC)
- `VenueSmeneSection.tsx` — 17 useState, 7 fetch (706 LOC)
- `WaiterSmeneSection.tsx` — 15 useState, 8 fetch (625 LOC)
  Single component owns many responsibilities (SRP break); near-impossible to unit-test.
  Progress (2026-06-18):
- WaiterPassportSection: extracted the notification-prefs concern (7 useState + togglePush
  - saveNotifPrefs + push-check effect + its GET) into co-located `useNotifPrefs.ts`.
    useState 26 → 19; one endpoint dropped from the load Promise.all. tsc + ESLint clean.
    ⚠ NOT yet verified in the running app — needs manual smoke test of the passport
    notification toggles (push/WhatsApp/SMS save) before relying on it.
- VenueSmeneSection: on inspection this was a PARTIAL FALSE POSITIVE — the file-level
  "17 useState" is already split across 4 cohesive sub-components (`ShiftTemplateTab` 7,
  `HeadWaiterPanel` 3, `PendingClockInRow` 1, main 5), not one god-body. Not a real SRP
  violation like WaiterPassportSection's 26-in-one-function. Applied the one genuine
  improvement: migrated `ShiftTemplateTab`'s GET to `useApi` (mutate covers the
  refetch-after-mutation calls). useState 17 → 15. tsc + ESLint clean.
  ⚠ NOT yet verified in app — smoke-test templates tab (list/create/delete/quick-apply/generate).
- WaiterSmeneSection: also already sub-componentised (`ClockInButton` + main `ShiftsSection`).
  Migrated the tab-driven fetch effect (open-shifts 30s poll + swap requests) to two
  `useApi` calls with `{ enabled: tab === ..., refreshMs }`. Removed 3 useState
  (openShifts/swapReqs/tabLoading), the whole useEffect, and the CQ-I client poll catch.
  useState 15 → 12. Full unit suite green (926 tests). ⚠ smoke-test the Smene tabs
  (mine/open/swaps), the 30s open-shift refresh, and claim.
- WaiterPassportSection (slice 2, 2026-06-18): extracted the sanitary-book concern (5 useState
  + its GET + submit + replace) into co-located `useSanitaryBook.ts`; dropped the sanitary
  endpoint from the load Promise.all. useState 19 → 14 (26 → 14 total across both slices).
  Verified in running app: passport page renders, sanitary card shows status from the hook,
  `GET /api/verification/sanitary 200`, 0 console errors. tsc + ESLint clean.
  Closed: the remaining profile-edit field grouping (bio/skills/languages/years/available/
  venuePrefs) is left as deliberate non-action — they're cohesive form fields with no
  cross-talk; bundling them into one object would be churn for no real SRP gain now that the
  two genuinely-separable concerns (notif, sanitary) are out. Worst offender resolved.
  Note: the real god-component was WaiterPassportSection. The file-level useState counts for
  VenueSmeneSection/WaiterSmeneSection overstate the smell because those files are already
  sub-componentised — verify per-function complexity, not per-file totals.
  Nodes: `WaiterPassportSection()`, `useNotifPrefs()` (new), `ShiftTemplateTab()` (migrated),
  `VenueSmeneSection()`, `WaiterSmeneSection()`.

### CQ-H — No data-fetching abstraction (root cause of CQ-G) [FIXED]

Severity: Important
Problem: no SWR/react-query/custom hook in deps; every section reimplements the
loading/error/data useState triplet + manual fetch + manual refetch.
Fix: added `src/hooks/useApi.ts` — `useApi<T>(url, { enabled?, refreshMs? })` returning
`{ data, error, isLoading, mutate }`. Unmount-safe, supports conditional fetch + silent
polling. Migrated `MarketInsights` (waiter-helpers.tsx) as proof — dropped a useState +
useEffect + bare catch. 4 unit tests (renderHook/happy-dom) pass. Documented in CLAUDE.md.
Follow-up: CQ-G migrates the heavy section components onto this hook.
Nodes: `useApi()` (new), `MarketInsights()` (migrated); cf. `useDashboardNav()`.
Resolved: 2026-06-18.

### CQ-I — Silent error swallowing in API routes + components [FIXED]

Severity: Important
Problem: bare `.catch(() => {})` across 10 sites. Classified on inspection:
SERVER (6, fixed → logged):

- `api/payments/monri/cancel:12` — payment PENDING→CANCELLED write → `logger.error`
- `api/waiters:104` — redis cache write → `logger.warn`
- `api/notifications:40` — redis cache write → `logger.warn`
- `api/notifications:64` — redis cache bust → `logger.warn`
- `api/admin/stats:113` — redis cache write → `logger.warn`
- `api/jobs/applications:125` — red-alert metric update → `logger.warn`
  CLIENT (4, left as-is — genuinely cosmetic best-effort, out of scope):
- `WaiterSmeneSection:107` (30s background poll), `WaiterPassportSection:50` (push-state
  check), `VenueReviewsSection:160` (clipboard copy), `waiter-helpers:248` (hook fetch).
  Fix: server sites now log via pino (warn=best-effort, error=load-bearing). ESLint clean.
  CLAUDE.md Logging section gained an explicit rule forbidding bare server-side catches.
  Nodes: `api/jobs/applications`, `api/waiters`, `api/notifications`, `api/admin/stats`,
  `api/payments/monri/cancel`.
  Resolved: 2026-06-18.

### CQ-J — console.\* in lib modules vs logging convention [FIXED]

Severity: Nice-to-have
Problem: original grep flagged `notify.ts`, `encryption.ts`, `env.ts`. On verification:

- `notify.ts:93` — inside JSDoc comment (usage example) → FALSE POSITIVE, no change.
- `encryption.ts:8,26` — comment + Error-message string (`node -e "console.log(...)"`)
  → FALSE POSITIVE, no change.
- `env.ts:13` — REAL `console.warn` in prod-only env validation → converted to `logger.warn`.
  Fix: `env.ts` console.warn → `logger.warn` (logger imports only pino, no circular dep).
  CLAUDE.md Logging section updated to record the boot-time exception.
  Nodes: `lib/core/env.ts` (real); `notify()`, `lib/core/encryption.ts` (false positives).
  Resolved: 2026-06-18.

### CQ-K — i18n speculative generality / YAGNI [FIXED]

Severity: Important
Problem: full sr|en|ru translation stack (`lib/i18n/index.ts` + provider + 3 flag comps).
  Original claim "only preloader consumes it" was partly stale — the auth flow (login/register/
  resetPassword) was already wired; dashboards were not. Build-ahead-of-need on the dashboards.
Decision history: first DEFERRED (keep + ticket), then owner chose START ROLLOUT (scaffold).
Rollout progress (2026-06-18):
  Waiter dashboard CHROME fully translated:
  - `waiterNav` namespace (nav labels), keyed by every `Section` value so `t("waiterNav", item.key)`
    type-checks the dynamic nav key.
  - `waiterTitles` namespace → header `sectionTitle` now `t("waiterTitles", section)`
    (dropped the `SECTION_TITLES` import).
  - `waiterUi` namespace → sign-out, role label, head-waiter nav label + badge.
  - `<FlagSwitcher />` mounted in the sidebar footer.
  Verified in running app (screenshot): switching to English renders header "Overview", nav
  Overview/Jobs/Shifts/Reviews/Passport/Notifications, "Sign out", role "Waiter" — all live,
  0 console errors. tsc + ESLint clean. Repeatable 3-step pattern documented in CLAUDE.md.
  Venue dashboard CHROME fully translated (2026-06-18): added `venueNav`/`venueTitles`/`venueUi`
  namespaces (keyed by all 11 venue `Section` values); wired nav labels, header `sectionTitle`,
  sidebar + profile-menu sign-out, the menu "Notifikacije" item, and role label via `t(...)`;
  mounted `<FlagSwitcher />` in the sidebar footer; dropped the `SECTION_TITLES` import.
  Verified in-app (screenshot): English renders header "Overview", nav Hiring/Shifts/Venue profile,
  role "Venue owner", "Sign out" — live, 0 console errors. tsc + ESLint clean.
Resolution (2026-06-18, owner decision "stop — chrome done"): CQ-K is resolved. The finding was
  "speculative generality" — infra built but unused on dashboards. That's no longer true: the
  translation system is now actively consumed across auth + preloader + both user-facing dashboard
  chromes, and a repeatable rollout pattern is documented in CLAUDE.md. The infra has earned its keep.
Investigated but intentionally NOT done (logged as optional, low-value backlog — do not re-flag):
  - Admin dashboard (`admin/page.tsx`, 538 LOC, 30+ inline stat labels): internal staff tooling,
    operators are Serbian-speaking → i18n value ≈ 0. High churn, no shared chrome pattern. SKIP.
  - Headhunter page (160 LOC, ~6 strings): small; no nav-chrome; content-level. Optional.
  - Section CONTENT for waiter/venue (OverviewSection + section bodies): dense inline strings,
    larger effort, lower priority than the chrome that's done. Optional, follow the CLAUDE.md pattern.
Nodes: `translations`, `waiterNav` (new), `WaiterDashboard()` / `waiter/page.tsx`,
  `FlagSwitcher()`, `LanguageProvider()`, `useLang()`.

### CQ-L — Waiter dashboard spams 403 on /api/shifts?view=manage [OPEN]

Severity: Nice-to-have
Found: 2026-06-18 during runtime smoke-test of CQ-G (verify run, not a regression — pre-existing).
Problem: `waiter/page.tsx` `fetchData()` unconditionally fetches `/api/shifts?view=manage`
for EVERY waiter on every dashboard load + refresh. Only head-waiters are authorized, so
non-head-waiters get `403` each time (observed repeatedly in dev log). Functionally harmless
— `if (manageRes.ok)` guards the result — but it pollutes network/logs and trips error
monitors (Sentry) with expected 403s.
Fix options: (a) make `GET /api/shifts?view=manage` return `200 { venue: null }` for
non-head-waiters instead of `403` (a waiter managing nothing is not "forbidden"); or
(b) gate the call behind known head-waiter status. (a) is cleaner — semantic fix, kills the noise.
Fix applied (2026-06-18): option (a) — `getWaiterShifts` view=manage branch now returns
`200 { venue: null, shifts: [] }` when the waiter heads no venue. Client guard
(`if (m?.venue)`) already handled the empty shape. No test asserted the 403. tsc+ESLint clean.
Verified in running app: `GET /api/shifts?view=manage 200` (was 403).
Nodes: `waiter/page.tsx` (`fetchData`), `GET /api/shifts` (`getWaiterShifts` / view=manage branch).

### CQ-M — CSP worker-src blocks service worker → web push dead [OPEN]

Severity: Important
Found: 2026-06-18 during runtime smoke-test of CQ-G (pre-existing; surfaced because
`useNotifPrefs` now owns the push-subscribe toggle).
Problem: `next.config.ts` CSP sets `worker-src blob:` (for Mapbox GL's blob workers) but omits
`'self'`. The web-push service worker at `/sw.js` is a same-origin script, so registration is
blocked: `Creating a worker from '.../sw.js' violates ... worker-src blob:`. Result: the push
toggle can never subscribe — web push notifications are effectively non-functional in all
environments using this CSP. The failure is swallowed (`useNotifPrefs` togglePush catch), so
it's silent to users.
Fix: `"worker-src 'self' blob:"` in `next.config.ts` CSP — allows both `/sw.js` and Mapbox blob
workers. Verify push subscribe works after (re-run the passport push toggle).
Fix applied (2026-06-18): CSP now `worker-src 'self' blob:`. Verified in running app — live
response header shows the new value, `/sw.js` registers (`active-or-installing`), and the
prior `worker-src` console violation is gone (0 occurrences, was 2). Note: completing an
actual push _subscribe_ additionally needs `NEXT_PUBLIC_VAPID_KEY` set + a real push service
(not exercisable headless) — the CSP block that prevented SW registration is resolved.
Nodes: `next.config.ts` (`CSP`), `useNotifPrefs()` (`togglePush`), `/sw.js`.

---

## Audit Re-run — 2026-06-18 (fresh graph, 2960 nodes, HEAD post-fixes)

Re-ran the graph analysis after CQ-F refreshed the graph and 6 fix commits landed.
Purpose: validate prior fixes don't recur and catch what the stale graph had hidden.

Recurrence / validation check:

- CQ-F holds — god-node list is clean: `db`(201), `dbRaw`(161), `withRole`(92), `parseBody`(84),
  `useRequireRole`(53), `seedUser`/`resetDb` (test helpers), `fireSideEffects`(42), `withAuth`(34).
  No duplicate `db`/`dbRaw`, no ghost `Community 102`, no triplicated scoring. All legit infra hubs.
- Isolated nodes 764 → 659 (improving). Extraction 100% EXTRACTED.

Dismissed (verified false positive):

- "Import Cycles" reported by graphify (`venue/page.tsx → page.tsx` self-cycle;
  `VenueSmeneSection ↔ page.tsx`; `ProfileSection ↔ page.tsx`). Grep confirms NO section file
  imports from `./page`, and a file cannot import itself — these are graphify edge-inference
  artifacts, not real cycles. No action.

### CQ-N — Public guest-review page is a god-component [FIXED]

Severity: Important
Found: 2026-06-18 fresh-audit re-run. The first pass missed it — graph staleness noise buried it;
it is NOT in the Smene/Passport trio that CQ-G covered.
Problem: `src/app/(public)/review/[venueId]/page.tsx` (392 LOC) main component holds ~17 useState:
a `Step` state-machine (8-value union: loading/error404/choose/venue/waiter/both-venue/
both-waiter/success) + flow state (venue, waiters, coords, geoError, apiError, submitting) +
6 scattered rating dimensions (venueAtmo/Org/Hyg, wFriendly/Speed/Attn) + 2 comments +
guestHandle + waiterId. This is the highest-traffic public entry point (guests scanning a QR),
so it's both the worst-tested and the most exercised. Scattered rating state = easy to desync.
Recommended refactor: (a) drive `step` transitions with a `useReducer` state machine instead of
raw setState; (b) collapse the review form (6 ratings + 2 comments + handle + waiterId) into a
single reducer or grouped object; (c) move the venue/waiters load (`/api/venues/[id]/public`)
onto `useApi`. Optionally split venue-rating vs waiter-rating into sub-form components.
Fix applied (2026-06-18): did (b) — collapsed the 10 scattered form useState (6 ratings +
  2 comments + guestHandle + waiterId) into a single typed `ReviewForm` object + `setField(k,v)`
  updater. Component useState 17 → 8; rating state can no longer desync (one source). Left
  step-machine and the data load as-is (distinct concerns, lower risk on a public page) — (a)/(c)
  remain optional polish. tsc + ESLint clean.
Verified in running app: drove the venue-review flow with spoofed geolocation at the venue
  coords. POST `/api/reviews/guest` body carried every field correctly
  (`guestHandle`, `ratingAtmosphere/Organization/HygieneWork`=100, `comment`, coords) and server
  returned **200**. Screenshot confirmed all fields bound/rendered from the `form` object. 0 console errors.
Nodes: `GuestReviewPage()` / `src/app/(public)/review/[venueId]/page.tsx`, `ReviewForm`, `Step`, `StarPicker()`.

### CQ-O — admin/page + ProfileSection bypass useApi [FIXED]

Severity: Nice-to-have
Found: 2026-06-18 fresh-audit re-run.
Problem: now that `useApi` exists (CQ-H), two more components still hand-roll fetch+state:
`admin/page.tsx` (7 inline `fetch`, 7 useState) and `venue/ProfileSection.tsx` (5 fetch, 11
useState, 4 useEffect). Same triplet `useApi` was built to remove — consistency debt, not a bug.
Recommended: migrate their GETs to `useApi` (admin dashboard parallel loads are the clearest win).
Fix applied (2026-06-18):
  - admin/page.tsx: migrated the 3 standalone single-GET fetches (activity / health / leaderboard)
    to `useApi` with `{ enabled: status === "authenticated" }`. useState 7 → 3. Left the 4-endpoint
    aggregation (Promise.all → derived `actions` counts) as-is — that's a genuine multi-source
    pattern that doesn't map 1:1 to `useApi`, and forcing it would add code.
  - ProfileSection.tsx: PARTIAL FALSE POSITIVE — its 5 `fetch` are all POST/PATCH writes (upload,
    venue update) and its useEffects sync local state from the `venue` PROP; it has no hand-rolled
    GET. `useApi` (GET-only) doesn't apply. The 11 useState are legit local UI state. No change.
Verified in running app: logged in as admin, /admin fully rendered; the migrated
  activity / health / leaderboard panels all populate (`GET /api/admin/{activity,health,leaderboard}`
  each returned 200), 0 console errors. tsc + ESLint clean.
Lesson (again): trust per-function complexity, not per-file `fetch`/useState counts — writes and
  prop-sync inflate the raw grep numbers.
Nodes: `AdminDashboard()` / `admin/page.tsx`, `ProfileSection()` (false positive).

---

## Telemetry Audit — 2026-06-18 (Production Observability run)

Graph-lens audit of the telemetry / exception / logging layer. Context correction:
the originating prompt assumed a greenfield observability stack, but the repo ALREADY
had `@sentry/nextjs ^10.53.1`, `instrumentation.ts`, 3× `sentry.*.config.ts`, 3 error
boundaries, pino JSON logging, and CI source-map upload. So this was a GAP audit, not a
build-from-zero. No prior RentCheck/PropertyPage/authOptions findings exist here (see
header note line 5) — these are net-new IDs starting at TEL-A.

### TEL-A — Error boundaries never report to Sentry [FIXED]

Severity: Important
Found: 2026-06-18 telemetry audit.
Problem: all 3 React error boundaries only `console.error(error)` — zero
`Sentry.captureException` anywhere in `src/`. `src/app/error.tsx` rendered `<html><body>`
(the global-error contract) while no `global-error.tsx` existed → root-layout crashes
unboundaried + unreported.
Fix applied (2026-06-18):
  - Added `src/app/global-error.tsx` (owns html/body, `Sentry.captureException`).
  - Rewrote `src/app/error.tsx` to drop the wrong html/body wrapper + capture to Sentry.
  - `(dashboard)/error.tsx` + `(public)/error.tsx`: `console.error` → `Sentry.captureException`.
  tsc + ESLint clean; 926 unit tests green.
  ⚠ NOT yet runtime-verified: actual Sentry event ingestion needs a live DSN (throw a
  synthetic error per boundary in staging and confirm the event lands with mapped frames).
Nodes: `src/app/error.tsx`, `global-error.tsx` (new), `(dashboard)/error.tsx`, `(public)/error.tsx`.

### TEL-B — No request correlation ID; logs uncorrelated with traces [FIXED]

Severity: Critical
Found: 2026-06-18 telemetry audit.
Problem: `src/middleware.ts` stamped no `trace_id`; pino lines and Sentry traces shared no ID.
No `AsyncLocalStorage` request context existed.
Fix applied (2026-06-18):
  - New `src/lib/core/request-context.ts` — ALS-backed `RequestContext` + `runWithRequestContext`.
  - `src/middleware.ts` generates/honours `x-request-id` on every inbound request, forwards it
    via request headers and echoes it on the response (401/redirect/passthrough all carry it).
  - `withRole`/`withAuth`/`withOptionalAuth` open an ALS scope (`runScoped`) reading the header
    (UUID fallback for tests), binding traceId/userId/route/method, echoing traceId on the response.
  Verified (live): unit-test log output now auto-carries `traceId`/`userId`/`route`/`method`
  (shift-claim warn). tsc + ESLint clean; 926 tests green.
  ⚠ Edge runtime has no ALS — context opens on the Node side (auth wrappers) by design.
Nodes: `src/middleware.ts`, `lib/core/request-context.ts` (new), `lib/auth/with-role.ts` (`runScoped`).

### TEL-C — Logger has no request-scoped context binding [FIXED]

Severity: Important
Found: 2026-06-18 telemetry audit.
Problem: bare pino singleton; context fields appended ad-hoc per call site.
Fix applied (2026-06-18): `lib/core/logger.ts` pino `mixin()` reads `getRequestContext()` and
  injects `traceId`/`userId`/`route`/`method` into every line (empty outside a request scope).
  Verified live in test output (see TEL-B). tsc + ESLint clean.
Nodes: `lib/core/logger.ts`, `lib/core/request-context.ts`.

### TEL-D — No Prisma / DB-tier span instrumentation [FIXED]

Severity: Important
Found: 2026-06-18 telemetry audit.
Problem: `tracesSampleRate` set but no Prisma spans → DB latency invisible.
Fix applied (2026-06-18): added `Sentry.prismaIntegration({ prismaInstrumentation: new
  PrismaInstrumentation() })` to `sentry.server.config.ts`; added `@prisma/instrumentation@7.6.0`
  as an explicit dep (was transitive). NOTE: Prisma 6.7 emits OTel query spans GA — the
  `previewFeatures=["tracing"]` flag is deprecated/unnecessary (Prisma warned on generate), so
  no schema change or client regen was needed.
  tsc + ESLint clean; 926 tests green.
  ⚠ NOT yet runtime-verified: confirm a sampled staging transaction contains ≥1 `db.prisma` span.
Nodes: `sentry.server.config.ts`, `prisma/schema.prisma` (comment only), `db`/`dbRaw`.

### TEL-E — Golden-signals / saturation coverage incomplete [FIXED]

Severity: Nice-to-have
Found: 2026-06-18 telemetry audit.
Problem: only cron monitors covered; no profiling, fixed sample rate, no pool-saturation metric,
no loud DSN guard.
Fix applied (2026-06-18):
  - `sentry.server.config.ts`: `tracesSampler` (keeps parent-sampled + errored/slow at 100%,
    else 0.1 prod) + `profilesSampleRate`.
  - `GET /api/admin/health`: added `db` block — live `SELECT 1` ping latency (portable saturation
    proxy) + configured `poolSize` + defensive `$metrics` busy/open gauges + `saturation` ratio
    (gauges null unless the Prisma `metrics` preview is later enabled — no regen forced here).
  - `lib/core/env.ts`: prod boot guard — `logger.error` when either Sentry DSN is missing
    (non-fatal; telemetry is optional infra, must not brick boot).
  tsc + ESLint clean; 926 tests green.
Nodes: `sentry.server.config.ts`, `src/app/api/admin/health/route.ts`, `lib/core/env.ts`.

---

## Audit Re-run — 2026-07-09 (fresh graph, 3003 nodes, HEAD 5eb0ff8)

Re-ran graph analysis 8 commits after the telemetry work landed. Graph refreshed via
`graphify update .` → 3003 nodes / 7424 edges / 204 communities, built from HEAD `5eb0ff83`.

Recurrence / validation check:
- CQ-F holds — god-node list clean (`db` 201, `dbRaw` 161, `withRole` 92, `parseBody` 84,
  `useRequireRole` 53, `fireSideEffects` 42). No phantom/duplicate nodes.
- All CQ-F→CQ-O + TEL-A→TEL-E confirmed FIXED, none regressed.
- CQ-I: remaining bare `.catch(() => {})` in `src/` are the client-cosmetic ones CQ-I cleared,
  EXCEPT one new server-lib swallow → CQ-S below.

### CQ-P — Waiter-search feature triplicated [FIXED]

Severity: Important
Found: 2026-07-09 graph re-audit (fresh graph, HEAD 5eb0ff8).
Problem: 3 clients consume `GET /api/waiters` — `headhunter/search`, `VenueDiscoverSection`,
`venue/invites` — each hand-rolls query-param build + filter state + result-card markup + local
Waiter type. No shared `useWaiterSearch` hook, no shared `WaiterResultCard` (verified: none in
`components/`). Cards render the same PassportTierBadge + score + skills + sanitary/verification set
from differently-named shapes (`w.waiterPassport` vs `p`).
Fix applied (2026-07-09):
- New `src/hooks/useWaiterSearch.ts` — canonical `WaiterFilters` type + pure `buildWaiterQuery()`
  (exported, unit-tested) + `useApi`-backed fetch, generic over the row shape `<T>` so each caller
  keeps its own typed response without a cross-file type merge.
- New `src/components/ui/WaiterCard.tsx` — shared result card with an `actions` render-slot +
  `showStats` / `maxSkills` display props.
- Rewired all 3 clients onto the hook; headhunter + discover onto the card.
- 5 new unit tests for `buildWaiterQuery`. tsc + ESLint clean; 943 unit tests green.
Deliberately NOT done: `venue/invites` keeps its own compact table-row markup (a genuinely distinct,
smaller presentation — one card there would be over-config); only its fetch was migrated to the hook.
Nodes: `useWaiterSearch()` (new), `WaiterCard()` (new), `headhunter/search/page.tsx`,
`VenueDiscoverSection()`, `venue/invites/page.tsx`, `GET /api/waiters`.

### CQ-Q — jobs/new god-form: scattered field useState [FIXED]

Severity: Important
Found: 2026-07-09 graph re-audit.
Problem: `venue/jobs/new/page.tsx` — one component body, 16 useState of which 11 are individual form
fields. Exact CQ-N smell; fix pattern not propagated. Repo already has the good pattern (grouped
`form` object) in `VenueSmeneModals` ShiftModal/TemplateModal — jobs/new ignores its own convention.
Desync risk, validation-hostile, untestable as a unit.
Fix applied (2026-07-09): collapsed the 11 form fields into one typed `JobPostForm` object +
`setField(k,v)` updater (CQ-N ReviewForm pattern). Control state (venues/loading/saving/error) stays
separate. Component useState 16 → 5. tsc + ESLint clean.
Nodes: `NewJobPostPage()` / `venue/jobs/new/page.tsx`. Refs: `ReviewForm` (CQ-N), `VenueSmeneModals.tsx`.

### CQ-R — Headhunter dashboard never modularized [FIXED]

Severity: Important
Found: 2026-07-09 graph re-audit.
Problem: `headhunter/search/page.tsx` is a single monolith — 7 scattered filter useState + fetch +
querystring + saved-profile mutation + card render in one 400-LOC file. CQ-G modularized waiter/venue
dashboards (section split + co-located hooks + useApi + `*-helpers`); headhunter was skipped entirely
(CQ-K noted it only for i18n, never for structure). SRP + architectural inconsistency.
Fix applied (2026-07-09): filters + fetch extracted to the shared `useWaiterSearch` (CQ-P); card render
extracted to `WaiterCard`. Filter state collapsed into `draft`/`applied` objects with `setField` — the
`applied` split preserves the button-triggered ("Pretraži") search UX (fetch only fires on submit, not
per keystroke). File dropped ~90 LOC of inline query + card markup. tsc + ESLint clean.
Nodes: `headhunter/search/page.tsx`, `useWaiterSearch()`, `WaiterCard()`. Refs: `waiter-helpers.tsx`.

### CQ-S — Server-side bare catch swallow in dispatch.ts [FIXED]

Severity: Nice-to-have
Found: 2026-07-09 graph re-audit (CQ-I recurrence — escaped original sweep via notify→dispatch refactor).
Problem: `lib/notifications/dispatch.ts:45` — `db.pushSubscription.delete(...).catch(() => {})`. Server lib
module, bare empty catch — violates the CLAUDE.md rule CQ-I/CQ-J set. Silent DB failure leaves dead push
subs accumulating with no signal.
Fix applied (2026-07-09): `.catch(delErr => logger.warn({ err: delErr, subId: sub.id }, "expired
push-sub cleanup failed"))` + `logger` import added to dispatch.ts. tsc + ESLint clean; 943 tests green.
Nodes: `dispatchPush()` / `lib/notifications/dispatch.ts`.

### CQ-T — Tier isActive resolution reinlined in leaderboard [FIXED]

Severity: Nice-to-have
Found: 2026-07-09 graph re-audit.
Problem: `getEffectiveTier()` (`lib/passport/tier.ts`) is the documented single source for tier-expiry
resolution. `admin/leaderboard/route.ts:62` reinlines it (`isActive: expiresAt ? expiresAt > now : false`).
(subscribe + monri/callback also do expiry math but legitimately SET new expiry — not violations.)
DRY + drift risk if the effective-tier rule ever gains a grace window / null nuance.
Fix applied (2026-07-09): `isActive: getEffectiveTier(w) !== "FREE"` — behaviour-identical to the old
ternary (verified: FREE/expired/null-expiry all map the same) but now routes through the single source.
tsc + ESLint clean.
Nodes: `admin/leaderboard/route.ts`, `getEffectiveTier()` / `lib/passport/tier.ts`.

### DA-C — instrumentation ↔ sentry.server.config import cycle [FALSE POSITIVE]

Found: 2026-07-09 graph re-audit. Graphify reports a 2-file cycle `instrumentation.ts ↔
sentry.server.config.ts`. NOT real: `instrumentation.ts` does `await import("./sentry.server.config")`
(Next.js `register()` dynamic-import contract); `sentry.server.config.ts` imports PrismaInstrumentation
from `@prisma/instrumentation`, not back. Back-edge inferred from "instrumentation" name substring —
same artifact class as the dismissed `venue/page.tsx` self-cycle (line 224). No action.

---

## Audit Re-run — 2026-07-23 (fresh graph, 3534 nodes, HEAD 07d19ce)

Re-ran graph analysis after the landing-page rework (`FeatureGrid` + `/for-venues` + `/for-waiters`
restructure) landed on `feat/smene-assignee-names`. Graph: 3534 nodes / 8423 edges / 240 communities.

Recurrence / validation check:
- God-nodes clean, all legit infra: `db`(210), `dbRaw`(147), `parseBody`(87), `withRole`(87),
  `useRequireRole`(53), `fireSideEffects`(43), `withAuth`(42). No phantom/duplicate.
- All 4 reported import cycles = the logged [FALSE POSITIVE] artifacts (`venue/page.tsx` self-cycle,
  `VenueSmeneSection↔page`, `ProfileSection↔page`, `instrumentation↔sentry.server.config`). Not re-flagged.
- `VenueSmeneSection` 685 LOC (was 706) — verified still sub-componentised (CQ-G note), NOT a recurrence.
- Newer leave/team sections (`WaiterOdmoriSection`/`VenueOdmoriSection`/`VenueTimSection`) verified CLEAN:
  they consume `useApi` (2–3 each) + are sub-componentised. CQ-G/CQ-H pattern propagated correctly.
- **New signal:** the CQ-G/CQ-R "modularize the god-file" fix never reached the `(public)` marketing
  pages — a new instance of the same class. See CQ-U.

### CQ-U — Marketing pages bypass the components/landing module system [OPEN]

Severity: Important (borderline Critical — architectural)
Found: 2026-07-23.
Problem: `/landing/page.tsx` = 23 LOC composing 9 extracted `components/landing/*` (Navbar, Footer,
HeroSection, FAQSection, HowItWorksSection, PassportShowcase, B2BSection…). The customer-facing
money-pages `for-venues/page.tsx` (610 LOC) and `for-waiters/page.tsx` (602 LOC) import NOTHING from
components/landing (verified) — each reinvents nav, footer, hero, FAQ shell, section scaffolding inline
in one client component. Same god-file class CQ-G/CQ-R fixed for dashboards; fix stopped at the
(dashboard) boundary. Two parallel landing architectures; the money-pages use the un-modular one.
Recommended: decompose each for-* page to a /landing-style thin composition; shared parametrized nav +
footer; extract page sections to components/landing/.
Nodes: `ForVenuesPage()`, `ForWaitersPage()`, `Navbar()`, `Footer()`, `FAQSection()`, `landing/page.tsx`.

### CQ-V — Duplicated presentational primitives across files [OPEN]

Severity: Important
Found: 2026-07-23.
Problem: `LogoMark` defined 4× with cosmetic drift (for-venues:11 `logo-mark` class; for-waiters:17
same; Navbar.tsx:12 inline-style bg; (auth)/layout.tsx:4 inline-style, 19px not 20px). `CheckOrange`
(venue) ≡ `CheckCircle` (waiter) — byte-identical SVG, two names. Footer + mobile-drawer nav copy-pasted
between the two for-* pages. DRY, cross-file.
Recommended: shared `LogoMark` (components/ui/, size prop) + `CheckIcon`; delete all inline copies.
Nodes: `LogoMark` (×4), `CheckOrange`/`CheckCircle`, `Footer()`.

### CQ-W — Landing data arrays fused into page bodies [OPEN]

Severity: Important
Found: 2026-07-23.
Problem: `faqItems`, pricing tiers, feature lists, stat strips declared as inline literals inside the
600-LOC for-* page files, interleaved with JSX. CLAUDE.md mandates co-located `*-constants.ts`(values)/
`*-types.ts`(types-only); landing never adopted it. Blocks i18n (CQ-K), untestable independent of markup,
fabricated metrics drift with no single source.
Recommended: extract data to `for-venues.content.ts`/`for-waiters.content.ts` (+ types), mirror
waiter-constants.ts/waiter-types.ts.
Nodes: `ForVenuesPage()`, `ForWaitersPage()`, `faqItems`, `VENUE_FEATURES`, `WAITER_FEATURES`.

### CQ-X — for-venues #demo lead form is a dead handler [OPEN]

Severity: Important
Found: 2026-07-23.
Problem: for-venues/page.tsx demo `<form>` does `onSubmit={(e)=>{e.preventDefault(); setSubmitted(true);}}`.
No fetch/POST/persistence; shows success while discarding the lead. Fake success hides the loss. Primary
venue conversion CTA captures nothing.
Recommended: POST to a real endpoint (e.g. POST /api/leads, rate-limited), set submitted only on 2xx,
surface errors + log. No faked success.
Nodes: `ForVenuesPage()` (demo form onSubmit, submitted state).

### CQ-Y — Icon inconsistency: FeatureGrid lucide vs pages hand-inline <svg> [OPEN]

Severity: Nice-to-have
Found: 2026-07-23.
Problem: FeatureGrid uses lucide-react; the for-* pages hand-inline dozens of raw <svg><path> for the
same icon concepts (check/pin/calendar/shield/star/arrow) with ad-hoc stroke/size. lucide-react already a
dep. Bespoke hero/card mockup art is legitimately custom — scope is the repeated icon glyphs only.
Recommended: replace repeated icon SVGs with lucide equivalents; keep bespoke brand/mockup art.
Nodes: `ForVenuesPage()`, `ForWaitersPage()`, `FeatureGrid()`.

### DA-D — Zero test coverage on (public) landing pages + new leave/team sections [OPEN]

Severity: Important
Found: 2026-07-23 devil's-advocate pass.
Problem: no test targets for for-venues, for-waiters, or the branch-new Odmori/Tim sections. for-* pages
structurally untestable due to CQ-U (inline logic, propless 600-LOC clients) — second-order cost of the
monolith.
Recommended: after CQ-U/CQ-W extraction, add tests for the extracted pure units (content shapes, form
submit handler).
Nodes: `ForVenuesPage()`, `ForWaitersPage()`, `WaiterOdmoriSection()`, `VenueOdmoriSection()`, `VenueTimSection()`.

### DA-E — register/page.tsx borderline CQ-N/CQ-Q grouped-state recurrence [OPEN]

Severity: Important (needs verification)
Found: 2026-07-23 devil's-advocate pass.
Problem: register/page.tsx 508 LOC, 7 useState in a multi-field role-branching form. If per-field useState
→ recurrence of the CQ-N/CQ-Q smell fixed in ReviewForm/JobPostForm. Unaudited — CQ-G/CQ-R never touched
(auth). Top-of-funnel conversion form.
Recommended: verify the 7 useState are fields; if so collapse to one typed RegisterForm object + setField.
Nodes: `RegisterPage()`/`(auth)/register/page.tsx`. Refs: `ReviewForm` (CQ-N), `JobPostForm` (CQ-Q).
