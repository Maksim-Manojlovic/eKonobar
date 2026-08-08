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
| CQ-U | Important    | Marketing pages bypass components/landing module system (SRP/DRY)    | [FIXED]          |
| CQ-V | Important    | Presentational primitives duplicated (LogoMark ×4, Check icon dupe)  | [FIXED]          |
| CQ-W | Important    | Landing data arrays fused into page bodies (data≠view; vs convention) | [FIXED]         |
| CQ-X | Important    | for-venues #demo lead form is a dead handler (discards submissions)  | [FIXED]          |
| CQ-Y | Nice-to-have | Icon inconsistency: FeatureGrid lucide vs pages hand-inline <svg>    | [PARTIALLY FIXED]|
| DA-D | Important    | Zero tests on (public) landing pages + new leave/team sections       | [FIXED]          |
| DA-E | Important    | register/page.tsx borderline CQ-N/CQ-Q grouped-state recurrence      | [FALSE POSITIVE] |
| CQ-Z | Critical     | db soft-delete extension covers 3 of ~12 read methods                | [FIXED]          |
| CQ-AA | Critical    | CQ-I/CQ-S recurrence: sweep never matched `} catch {` block form     | [FIXED]          |
| CQ-AB | Important   | `(dbRaw as any)` on the password-reset flow                          | [FIXED]          |
| CQ-AC | Important   | Route-test harness copy-pasted across half the suite                 | [PARTIALLY FIXED]|
| CQ-AD | Important   | Venue-type consolidation stops at the seed layer                     | [FIXED]          |
| CQ-AE | Critical    | resetDb() can TRUNCATE production — no guard on DATABASE_URL         | [FIXED]          |
| DA-F | Critical     | CQ-F mis-root-caused: phantom god nodes are label collisions         | [FIXED]          |
| DA-G | Important    | test-results/ neither gitignored nor graph-excluded                  | [FIXED]          |

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

### CQ-U — Marketing pages bypass the components/landing module system [FIXED]

Severity: Important (borderline Critical — architectural)
Found: 2026-07-23.
Problem: `/landing/page.tsx` = 23 LOC composing 9 extracted `components/landing/*` (Navbar, Footer,
HeroSection, FAQSection, HowItWorksSection, PassportShowcase, B2BSection…). The customer-facing
money-pages `for-venues/page.tsx` (610 LOC) and `for-waiters/page.tsx` (602 LOC) import NOTHING from
components/landing (verified) — each reinvents nav, footer, hero, FAQ shell, section scaffolding inline
in one client component. Same god-file class CQ-G/CQ-R fixed for dashboards; fix stopped at the
(dashboard) boundary. Two parallel landing architectures; the money-pages use the un-modular one.
Fix applied (2026-07-23): extracted the shared shell — `components/landing/LandingNav.tsx` (parametrized
client nav + mobile drawer; `links`/`cta`/`badge` props) and `LandingFooter.tsx` (`links` prop) — and
rewired both pages onto them. Both money-pages now import from components/landing (+ components/ui), ending
the two-parallel-architectures split; the duplicated nav-drawer + footer markup and the per-page
`mobileOpen` state are gone (for-waiters now has zero useState). Combined with CQ-V/CQ-W, pages dropped
610/602 → 424/438 LOC. Deliberately NOT done (optional follow-up): per-section component extraction of the
bespoke section bodies (operativa/hero-mockup/pricing) — lower value once the shared shell + data are out.
Nodes: `ForVenuesPage()`, `ForWaitersPage()`, `LandingNav()` (new), `LandingFooter()` (new), `landing/page.tsx`.

### CQ-V — Duplicated presentational primitives across files [FIXED]

Severity: Important
Found: 2026-07-23.
Problem: `LogoMark` defined 4× with cosmetic drift (for-venues:11 `logo-mark` class; for-waiters:17
same; Navbar.tsx:12 inline-style bg; (auth)/layout.tsx:4 inline-style, 19px not 20px). `CheckOrange`
(venue) ≡ `CheckCircle` (waiter) — byte-identical SVG, two names. Footer + mobile-drawer nav copy-pasted
between the two for-* pages. DRY, cross-file.
Fix applied (2026-07-23): added `components/ui/LogoMark.tsx` (`className`/`svg` size props, uses
`.logo-mark`) + `components/ui/CheckIcon.tsx`; replaced all 4 LogoMark copies (both landing pages,
landing/Navbar, auth/layout) and both Check* copies. tsc + ESLint clean. (Footer/nav-drawer dup handled
by CQ-U's LandingNav/LandingFooter.)
Nodes: `LogoMark()` (new), `CheckIcon()` (new), `Navbar()`, `(auth)/layout.tsx`, `ForVenuesPage()`, `ForWaitersPage()`.

### CQ-W — Landing data arrays fused into page bodies [FIXED]

Severity: Important
Found: 2026-07-23.
Problem: `faqItems`, pricing tiers, feature lists, stat strips declared as inline literals inside the
600-LOC for-* page files, interleaved with JSX. CLAUDE.md mandates co-located `*-constants.ts`(values)/
`*-types.ts`(types-only); landing never adopted it. Blocks i18n (CQ-K), untestable independent of markup,
fabricated metrics drift with no single source.
Fix applied (2026-07-23): created co-located `for-venues/content.tsx` + `for-waiters/content.tsx` holding
nav/footer links, `*_FEATURES`, `faqItems`, hero stats, and (venue) comparison rows. Pages import the data;
JSX stays in page.tsx. `.tsx` because FAQ answers carry inline JSX (documented in CLAUDE.md). Pages
610/602 → 424/438 LOC. The content shapes are now unit-tested (DA-D). tsc + ESLint clean.
Nodes: `for-venues/content.tsx` (new), `for-waiters/content.tsx` (new), `ForVenuesPage()`, `ForWaitersPage()`.

### CQ-X — for-venues #demo lead form is a dead handler [FIXED]

Severity: Important
Found: 2026-07-23.
Problem: for-venues/page.tsx demo `<form>` does `onSubmit={(e)=>{e.preventDefault(); setSubmitted(true);}}`.
No fetch/POST/persistence; shows success while discarding the lead. Fake success hides the loss. Primary
venue conversion CTA captures nothing.
Fix applied (2026-07-23): new `POST /api/leads` (public, in PUBLIC_API_PATTERNS; rate-limited `lead:{ip}`
5/h via getClientIp). Zod-validates `{venueName,name,phone,venueType?}`, writes `logger.info("demo lead
captured")` (durable record) + fires best-effort `sendDemoLeadEmail` (no-op without SMTP, recipient
`LEADS_EMAIL ?? SMTP_USER`). Form posts via FormData, awaits, shows success only on 2xx, disables button
while sending, surfaces errors. Route unit-tested (429/400/200/email-throws → DA-D). tsc + ESLint clean.
Nodes: `POST /api/leads` (new route), `sendDemoLeadEmail()` (new), `src/middleware.ts`, `ForVenuesPage()`.

### CQ-Y — Icon inconsistency: FeatureGrid lucide vs pages hand-inline <svg> [PARTIALLY FIXED]

Severity: Nice-to-have
Found: 2026-07-23.
Problem: FeatureGrid uses lucide-react; the for-* pages hand-inline dozens of raw <svg><path> for the
same icon concepts (check/pin/calendar/shield/star/arrow) with ad-hoc stroke/size. lucide-react already a
dep. Bespoke hero/card mockup art is legitimately custom — scope is the repeated icon glyphs only.
Fix applied (2026-07-23): replaced the 3 repeated CTA arrow glyphs (hero + final CTAs) with lucide
`ArrowRight`. Intentionally PARTIAL — the remaining inline SVGs are either bespoke mockup art (passport
card, dashboard mockup, hero underline) or one-off styled section/check glyphs with specific fills; full
de-SVG is low-value churn on marketing pages with visual-regression risk. Nice-to-have, left as optional.
Nodes: `ForVenuesPage()`, `ForWaitersPage()`.

### DA-D — Zero test coverage on (public) landing pages + new leave/team sections [FIXED]

Severity: Important
Found: 2026-07-23 devil's-advocate pass.
Problem: no test targets for for-venues, for-waiters, or the branch-new Odmori/Tim sections. for-* pages
structurally untestable due to CQ-U (inline logic, propless 600-LOC clients) — second-order cost of the
monolith.
Fix applied (2026-07-23): CQ-U/CQ-W extraction made the units testable. Added `api/leads/__tests__/route.test.ts`
(429 rate-limited / 400 invalid / 200 + email+log / 200 when email throws) and content-shape tests for both
`for-venues`/`for-waiters` content modules (features/links/comparison/stats/faq). 13 new tests; full unit
suite green (1335). Deliberately scoped to the landing units this branch touched — the Odmori/Tim sections
were verified CLEAN (useApi + sub-componentised) in the 2026-07-23 re-run, so behavioural tests for them are
a separate, lower-priority backlog item, not part of this fix.
Nodes: `api/leads/__tests__/route.test.ts` (new), `for-venues/__tests__/content.test.ts` (new),
`for-waiters/__tests__/content.test.ts` (new).

### DA-E — register/page.tsx borderline CQ-N/CQ-Q grouped-state recurrence [FALSE POSITIVE]

Severity: Important (needs verification)
Found: 2026-07-23 devil's-advocate pass.
Problem: register/page.tsx 508 LOC, 7 useState in a multi-field role-branching form. If per-field useState
→ recurrence of the CQ-N/CQ-Q smell.
Verified (2026-07-23): NOT a recurrence. All 11 form fields are already grouped into one `form: FormState`
object with an `f(key)` change-handler factory (the exact CQ-N/CQ-Q pattern). The 7 useState are `form`
(grouped) + legit control state (`step`, `role`, `showPassword`, `error`, `loading`). No fix — per-file
useState count overstated the smell (same lesson as CQ-G/CQ-O: trust per-function structure, not raw counts).
Nodes: `RegisterPage()`/`(auth)/register/page.tsx` (`form`/`FormState`/`f()`).

---

## Audit Re-run — 2026-08-08 (fresh graph, 3582 nodes, HEAD 9389d2af)

Re-ran graph analysis after the venue-type taxonomy work landed. Graph refreshed via
`graphify update .` → 3582 nodes / 8555 edges / 229 communities, built from HEAD `9389d2af`.

Recurrence / validation check:
- All 4 reported import cycles = the logged [FALSE POSITIVE] artifacts. Not re-flagged.
- **CQ-F does NOT hold — see DA-F.** The god-node table still emits phantoms on a FRESH graph,
  so "staleness" was the wrong root cause. Every prior run's "god-nodes clean" validation
  (2026-06-18, 07-09, 07-23) was reasoning from partly-fictional topology.
- CQ-I/CQ-S both only ever swept `.catch(() => {})` — the `} catch {` form was never in scope. See CQ-AA.
- Cleared on inspection, do not re-flag: `lib/analytics/waiter-analytics.ts` (427 LOC but 11 pure
  functions, 0 await, 0 db calls — exemplary); `api/leave/requests/route.ts` (390 LOC but imports
  ~20 functions from 7 `lib/leave/*` modules — orchestrator, not hoarder); `VenueSmeneSection`
  685 LOC (sub-componentised per CQ-G).

### CQ-Z — db soft-delete extension covers 3 of ~12 read methods [OPEN]

Severity: Critical
Found: 2026-08-08 graph re-audit.
Problem: `lib/core/db.ts` intercepts only findMany/findFirst/findUnique, for 3 models, as 9
byte-identical 4-line blocks + 9 eslint-disables. `count`/`aggregate`/`groupBy`/`findUniqueOrThrow`/
`findFirstOrThrow` bypass the filter entirely. CLAUDE.md documents an absolute guarantee ("never
returns rows where deletedAt IS NOT NULL") that is false for most read ops.
NO live leak found: the single bypass `db.user.count({where})` (`api/waiters/route.ts:84`) is safe
only because line 41 hand-writes `deletedAt: null` — a caller re-implementing the filter the
abstraction claims to own is itself the evidence the abstraction leaks.
Blast radius: `db` is god-node #1 (210 edges). Failure mode is silent + privacy-shaped.
Recommended: generate the extension over a `SOFT_DELETE_MODELS × READ_OPS` matrix instead of
hand-writing 9 blocks; drop the now-redundant manual guard in the waiters route; add a test
asserting a soft-deleted user is invisible to `db.user.count()`.
Nodes: `db`(#1), `dbRaw`(#2), `lib/core/db.ts`, `GET /api/waiters`.

### CQ-AA — CQ-I/CQ-S recurrence: sweep matched only `.catch(() => {})`, never `} catch {` [OPEN]

Severity: Critical
Found: 2026-08-08 graph re-audit.
Problem: CQ-I [FIXED] (6 sites) and CQ-S [FIXED] (1 site) both swept the arrow form only. 21
block-form `} catch {` sites remain in `src/app/api` + `src/lib`. The CLAUDE.md rule inherited the
flaw — it is phrased around `.catch(() => {})` specifically, so the block form was never in scope.
Classified on inspection (not flagged by count):
  - LEGITIMATE: `parse-body.ts:25` (JSON parse → 400), `redis-lock.ts:35,48` (discriminated result,
    commented), `notify.ts:47` (commented cache fall-through).
  - REAL SWALLOW: `dispatch.ts:76` + `dispatch.ts:101` — WhatsApp/SMS provider errors caught,
    `return false`, zero logging. Same file CQ-S marked FIXED; CQ-S fixed line 45 and left these two.
Impact: rejected Meta template / expired WA_ACCESS_TOKEN / Infobip 401 are indistinguishable from
"user not opted in"; the retry cron then re-fires 3x against an unknowable failure.
Recommended: log at both sites; re-scope the CLAUDE.md rule to behaviour not syntax.
Nodes: `dispatchWhatsApp()`, `dispatchSms()` / `lib/notifications/dispatch.ts`. Refs: CQ-I, CQ-S.

### CQ-AB — `(dbRaw as any)` on the password-reset flow [OPEN]

Severity: Important
Found: 2026-08-08 graph re-audit.
Problem: 7 `as any` casts, 6 on auth-critical paths — `forgot-password:28,40`,
`reset-password:18,35,36,40` — covering token lookup, expiry/usedAt validation and the bcrypt-write
transaction. `dbRaw` is a plain typed PrismaClient and `passwordResetToken` is a real model.
VERIFIED UNNECESSARY: compiled a probe calling `dbRaw.passwordResetToken.findUnique(...)` and
`dbRaw.user.findUnique(...)` with no cast → `tsc --noEmit` exit 0, zero errors. Leftovers from
before the model was generated.
`admin/health:62` (`$metrics`) is the one legitimate cast — preview API genuinely absent from the type.
Recommended: delete the 6 auth casts; replace the `$metrics` cast with a narrow local interface.
Nodes: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `dbRaw`(#2), `GET /api/admin/health`.

### CQ-AC — Route-test harness copy-pasted across half the suite [OPEN]

Severity: Important
Found: 2026-08-08 graph re-audit.
Problem: across 126 test files — `makeReq` redefined in 61, `mockSession` in 59, `CTX` in 40,
`mockNoSession` in 37, `makeCtx` in 29 (~226 copies of 5 functions). No shared unit-test helper
module: `src/tests/` holds only `integration/`.
This is CQ-P's finding (triplicated feature → extract shared hook) at 20x scale, in the layer no
audit has covered. The NextRequest construction contract is frozen into 61 files; session-mock shape
drifts per file; CLAUDE.md documents the pattern in prose because there is no module to point at.
Recommended: add `src/tests/unit/route-harness.ts`; migrate incrementally; point CLAUDE.md at it.
Nodes: `makeReq()`(61), `mockSession()`(59), `CTX`(40), `mockNoSession()`(37), `makeCtx()`(29). Refs: CQ-P.

### CQ-AD — Venue-type consolidation stops at the seed layer [OPEN]

Severity: Important
Found: 2026-08-08 — immediate recurrence of the drift class fixed the same session (commit 9389d2af).
Problem: `prisma/seed-demo.ts:38` is a 5th hardcoded venue-type list carrying the PRE-CHANGE six
values (NIGHT_CLUB missing). Typed `VenueType[]`, so every element is valid and tsc stays silent —
incomplete, not wrong. The guard added in 9389d2af (`display-maps.test.ts`) does NOT reach `prisma/`.
Impact: demo/dev databases can never contain a night club, so the new "Noćni klub" filter chip and
green map marker render against a dataset that structurally cannot exercise them.
Recommended: `Object.values(VenueType)` in seed-demo so it cannot under-cover.
Nodes: `VENUE_TYPES` / `prisma/seed-demo.ts:38`, `prisma/seed.ts`, `lib/formatting/display-maps.ts`.

### DA-F — CQ-F mis-root-caused: phantom god nodes are label collisions, not staleness [OPEN]

Severity: Critical
Found: 2026-08-08 devil's-advocate pass. RECURRENCE + WRONG DIAGNOSIS of CQ-F [FIXED].
Problem: CQ-F attributed phantom duplicate nodes to graph staleness and closed it by running
`graphify update .`. Today's FRESH graph (HEAD 9389d2af) still emits phantoms, so staleness was not
the cause.
Evidence: god-node #9 is `VENUE_TYPES` at 36 edges, attributed to `(public)/venues/page.tsx:13` —
a ONE-LINE constant. Its 36 edges are overwhelmingly symbols from a different file: `Section`,
`AppFilter`, `VenueShift`, `Venue`, `TemplateMeta` … all from `(dashboard)/venue/venue-types.ts`.
The identifier `VENUE_TYPES` and the module `venue-types.ts` normalize to the same key (nodes carry
a `norm_label` field), so a trivial constant absorbed an entire type module's edge set.
Two further phantoms: a `VENUE_TYPES` node at `admin/venues/page.tsx L18` where NO such declaration
exists (verified by grep), and a duplicate at `(public)/venues/page.tsx L11` beside the real L13 one.
Cross-check: `graphify explain "VENUE_TYPES"` returns the real node at degree 1 — against 36 in the
god-node table.
Why critical: the god-node table is this audit series' primary instrument. Three prior runs opened by
validating against it and each declared it "clean". `graphify update` regenerates rather than fixes it.
Recommended: verify per-node degree via `graphify explain` before trusting any god-node entry; inline
the colliding `VENUE_TYPES` const; record that god-node rank is advisory.
Nodes: `VENUE_TYPES`(#9, phantom), `venue-types.ts`. Refs: CQ-F.

### DA-G — test-results/ neither gitignored nor graph-excluded [OPEN]

Severity: Important
Found: 2026-08-08 devil's-advocate pass.
Problem: Playwright failure artifacts contribute 58 nodes to the graph. `.gitignore` has no
`test-results` entry — 10 untracked directories plus a tracked, modified `test-results/.last-run.json`.
No `.graphifyignore` exists.
Impact: (1) the audit instrument is diluted with failure dumps, inflating the isolated-node count
(659 → 923 across runs); (2) staging commit 9389d2af required hand-listing 12 paths to avoid
sweeping traces/screenshots in — one `git add -A` away from committing binary Playwright traces.
Recommended: gitignore `test-results/`, `playwright-report/`, `blob-report/`; `git rm --cached` the
tracked file; add `.graphifyignore`.
Nodes: `test-results/*` (58 nodes), `.gitignore`, `graphify-out/graph.json`. Refs: CQ-F, DA-F.

---

## Fix Pass — 2026-08-08 (branch `fix/audit-cq-z-through-da-g`)

All eight findings from the 2026-08-08 re-audit fixed in one pass, one at a time, each
verified before the next. Final state: tsc exit 0 · ESLint clean (2 pre-existing warnings)
· **1357 unit tests / 112 files green** (was 1334/109) · `next build` exit 0.
Integration tests deliberately NOT run — see CQ-AE.

### CQ-Z — resolution [FIXED]

Replaced the 9 hand-written blocks with one `excludeDeleted` callback applied over a
`SOFT_DELETE_READ_OPS × SOFT_DELETE_MODELS` matrix. Coverage went from 3 read ops to 8
(added `findFirstOrThrow`, `findUniqueOrThrow`, `count`, `aggregate`, `groupBy`). The
9 `eslint-disable @typescript-eslint/no-explicit-any` lines are gone with it.
Kept the model map explicit (`user/venue/jobPost` spelled out) rather than generated —
building it with `Object.fromEntries` erases the extension's types and degrades `db` for
all 210 of its callers. Verified: tsc exit 0 with `db` types intact.
Removed the hand-rolled `deletedAt: null` from `api/waiters/route.ts` — duplicating the
invariant is exactly what hid the gap.
Also handled: an explicit caller-supplied `deletedAt` still wins (admin restore flows).
Tests: `src/lib/core/__tests__/db-soft-delete-ops.test.ts`, 8 cases, incl. an op-coverage
assertion that fails when a read op is added to Prisma but not to the array.
Nodes: `excludeDeleted()` (new), `SOFT_DELETE_READ_OPS` (new), `lib/core/db.ts`, `GET /api/waiters`.

### CQ-AA — resolution [FIXED]

Root fix was the rule shape, not the instance. Added ESLint `no-restricted-syntax` banning
`CatchClause[param=null]` across `src/lib/**` + `src/app/api/**` (`eslint.config.mjs`).
`no-empty` does not cover this — it ignores blocks containing comments or statements, which
is why every prior sweep missed the form.
Ran the rule and swept all 21 sites it found:
  - LOGGED (real swallows): `dispatch.ts` whatsapp + sms (the CQ-S leftovers),
    `forgot-password` email send (`logger.error` — a broken SMTP config previously produced
    no server signal at all), `notifications/stream` unread poll, `admin/stats`,
    `notifications`, `waiters/coverage`, `waiters` search, `revocation`, `rate-limit` ×3,
    `redis-lock` ×2, `notify` prefs cache.
  - DISCARDED WITH A DOCUMENTED REASON (eslint-disable + why): `admin/health` ×3 (the
    null/false IS the reported probe result), `parse-body` + `venues/[id]` website
    (validation-by-exception — the 400 IS the handling), `notifications/stream` ×3
    (controller closed = normal client disconnect, would log per closed tab).
No PII in any new log line (no phone numbers).
CLAUDE.md rule re-scoped to behaviour: "never discard a server-side error — in any syntax".
Nodes: `eslint.config.mjs`, `dispatchWhatsApp()`, `dispatchSms()`, + 12 route/lib files.

### CQ-AB — resolution [FIXED]

Deleted all 6 auth casts and both file-level `/* eslint-disable @typescript-eslint/no-explicit-any */`
headers (`forgot-password`, `reset-password`). Replaced the `$metrics` cast with a declared
`PrismaMetricsApi` structural type, which also removed the inner `(g: any)` in the gauge lookup.
`any` in non-test `src/`: 23 → 5. `dbRaw as any`: 7 → 0.
Nodes: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/admin/health`.

### CQ-AC — resolution [PARTIALLY FIXED]

Added `src/tests/unit/route-harness.ts` — `getReq`, `jsonReq`, `postReq`/`patchReq`/`putReq`,
`CTX`, `ctxWith`, `mockSession`, `mockNoSession`. `vi.mock(...)` stays in the caller (Vitest
hoists it); the harness only removes what follows.
Migrated 3 files as proof (`admin/health`, `admin/leaderboard`, `admin/activity`) — all green.
Deliberately PARTIAL: converting the remaining ~58 files is mechanical churn with real
review cost and no behaviour change. CLAUDE.md now forbids new local copies and asks for
opportunistic conversion when a test file is touched. Re-scope to [FIXED] once the count is
near zero; the harness existing is what stops the bleeding.
Nodes: `src/tests/unit/route-harness.ts` (new), 3 migrated test files.

### CQ-AD — resolution [FIXED]

`prisma/seed-demo.ts` now derives all four enum lists with `Object.values()` — `VENUE_TYPES`,
`ENGAGEMENTS`, `TIPS`, `VERIF` — after switching `@prisma/client` from `type` imports to value
imports. Fixed the whole class, not just the venue-type instance: the other three were complete
today but carried identical drift risk.
Nodes: `prisma/seed-demo.ts`.

### CQ-AE — NEW, found during the fix pass [FIXED]

Severity: Critical
Found: 2026-08-08 while verifying CQ-Z — discovered before running anything, not after.
Problem: `resetDb()` TRUNCATEs every application table and reads whatever `DATABASE_URL` is in
`.env`. On this machine that is the **production Supabase pooler**. `npm run test:integration`
would have wiped production with no prompt, no confirmation and no undo. Nothing in the repo
prevented it; `src/tests/integration/setup.ts` only checks that the URL *connects*.
This is also why the CQ-Z verification used a unit test rather than the existing
`db-soft-delete.integration.test.ts`.
Fix: `assertResettableDatabase()` runs first inside `resetDb()` and throws unless the host is
loopback / a Docker Compose service name (`localhost`, `127.0.0.1`, `::1`, `db`, `postgres`,
`postgresql`) or the database name contains `test`. `ALLOW_DESTRUCTIVE_DB_RESET=1` overrides it
for genuinely ephemeral CI databases. The refusal message names the host and database so the
mistake is obvious, and points at Docker Compose.
Tests: `src/tests/unit/__tests__/db-reset-guard.test.ts`, 9 cases (refuses Supabase, allows
localhost/127.0.0.1/compose host, allows `*_test` DB names, honours the opt-out, refuses unset
and unparseable URLs). Deliberately a unit test — it must prove we do NOT touch a database.
One test caught a real subtlety during writing: `assertResettableDatabase(undefined)` falls
through to the default parameter and reads the env var, so "no URL configured" had to be tested
by clearing `process.env.DATABASE_URL`, not by passing `undefined`.
Nodes: `assertResettableDatabase()` (new), `resetDb()` / `src/tests/integration/db-reset.ts`.

### DA-F — resolution [FIXED]

Renamed the colliding constant `VENUE_TYPES` → `TYPE_FILTERS` in `(public)/venues/page.tsx`.
That alone did NOT clear the phantom, and chasing why produced a much larger finding.

**Corrected root cause — `graphify update` never prunes deleted symbols.** Evidence, in order:
  1. After the rename, the 36-edge `VENUE_TYPES` node persisted, still sourced at
     `venues/page.tsx` L13 — which by then was a *comment* mentioning the old name. Comments
     are indexed, so the explanatory comment recreated the node. Reworded to drop the token.
  2. The node STILL persisted with the token absent from the file entirely.
  3. `graphify update . --force` refused: "No code-graph topology changes detected".
  4. `rm graphify-out/graph.json && graphify update .` finally cleared it.

Measured on the same commit:

| | nodes | edges | communities | `db` edges | test-results nodes |
|---|---|---|---|---|---|
| incremental `update` | 3625 | 8624 | 252 | 210 | 58 |
| clean rebuild | **2407** | **4582** | 177 | **116** | **0** |

**A third of the nodes and nearly half the edges were phantom.** This retroactively invalidates
every "god-nodes clean, all legit infra" validation in this log (2026-06-18, 07-09, 07-23,
08-08) — they were reading roughly doubled degrees. CQ-F was right that staleness was the
problem and wrong about the remedy: `graphify update .` is exactly what does NOT fix it.
Fix: CLAUDE.md now documents `rm graphify-out/graph.json && graphify update .` as the required
pre-audit step, keeps `graphify explain` as the per-node cross-check, and records that local
identifiers (and comments) must avoid module basenames.
Nodes: `TYPE_FILTERS` (renamed), `(public)/venues/page.tsx`, CLAUDE.md, CQ-F (superseded).

### DA-G — resolution [FIXED]

`.gitignore` now covers `test-results/`, `playwright-report/`, `blob-report/`,
`playwright/.cache/`; `git rm --cached test-results/.last-run.json` untracked the one tracked
artifact. `git status` is now clean of Playwright noise — staging no longer requires
hand-listing paths.
A `.graphifyignore` was written and then **removed**: the graphify CLI has no such option
(`graphify --help` lists none), so shipping it would have been dead config that looked load-bearing.
Graph exclusion is handled by `.gitignore` instead — a clean rebuild honours it, taking
test-results from 58 nodes to **0**. The earlier incremental refreshes still showed 54 because
of the DA-F pruning bug, not because the ignore failed.
Nodes: `.gitignore`, `graphify-out/graph.json`.
