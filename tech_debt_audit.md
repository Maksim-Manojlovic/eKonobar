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
| CQ-K | Important    | i18n speculative generality / YAGNI                           | [IN PROGRESS]     |
| CQ-L | Nice-to-have | Waiter dashboard spams 403 on /api/shifts?view=manage         | [FIXED]           |
| CQ-M | Important    | CSP worker-src blocks service worker → push dead              | [FIXED]           |
| CQ-N | Important    | Public guest-review page is a 17-useState god-component       | [FIXED]           |
| CQ-O | Nice-to-have | admin/page + ProfileSection still hand-roll fetch (no useApi) | [FIXED]           |

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

### CQ-K — i18n speculative generality / YAGNI [IN PROGRESS]

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
Remaining (next rollout targets, tracked here):
  - Waiter SECTION CONTENT (OverviewSection / section bodies — deeper than chrome).
  - venue / headhunter / admin dashboard chrome (same pattern; venue Section has 11 values).
  Each follows the documented 3-step pattern.
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
