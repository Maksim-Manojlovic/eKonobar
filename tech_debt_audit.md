# eKonobar — Technical Debt Audit Log

Graph-based code quality audit. Findings sourced from Graphify graph (`graphify-out/`) cross-referenced against current source. Append new findings with incremental IDs (`CQ-<letter>`). Statuses: `[OPEN]` · `[IN PROGRESS]` · `[FIXED]` · `[PARTIALLY FIXED]` · `[FALSE POSITIVE]` · `[WONTFIX]`.

> Note: this project has no prior `RentCheck` audit log. IDs start at `CQ-F` (the originating prompt referenced a RentCheck log ending at `CQ-E`; continued here for traceability).

## Status Table

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| CQ-F | Critical | Stale Graphify graph poisons graph-based audits | [FIXED] |
| CQ-G | Important | God-components: state-heavy dashboard sections | [PARTIALLY FIXED] |
| CQ-H | Important | No data-fetching abstraction (root cause of CQ-G) | [FIXED] |
| CQ-I | Important | Silent error swallowing in API routes + components | [FIXED] |
| CQ-J | Nice-to-have | console.* in lib modules vs logging convention | [FIXED] |
| CQ-K | Important | i18n speculative generality / YAGNI | [DEFERRED] |
| CQ-L | Nice-to-have | Waiter dashboard spams 403 on /api/shifts?view=manage | [FIXED] |
| CQ-M | Important | CSP worker-src blocks service worker → push dead | [FIXED] |

---

## Findings

### CQ-F — Stale Graphify graph poisons graph-based audits  [FIXED]
Severity: Critical
Problem: graph @ `b9b39df6`, HEAD `cda71e4` (8 commits behind). Deleted flat `lib/*.ts`
  files persisted as nodes → phantom god-nodes (`db` x2, `dbRaw` x2), phantom scoring
  triplication, phantom `Community 102` (`lib/audit.ts`/`lib/db.ts`/`lib/notify.ts`...).
Fix: ran `graphify update .` → 2935 nodes / 7305 edges / 207 communities, fresh from HEAD.
Follow-up: enforce `graphify update .` in pre-commit / CI so it cannot drift again.
Nodes: `db`(#1,#2), `dbRaw`(#3,#5), Community 7, Community 102.
Resolved: 2026-06-18 — graph refreshed this session.

### CQ-G — God-components: state-heavy dashboard sections  [PARTIALLY FIXED]
Severity: Important
Problem: section components hoard local state + inline fetching:
  - `WaiterPassportSection.tsx` — 26 useState, 12 fetch, 3 useEffect (701 LOC)
  - `VenueSmeneSection.tsx` — 17 useState, 7 fetch (706 LOC)
  - `WaiterSmeneSection.tsx` — 15 useState, 8 fetch (625 LOC)
  Single component owns many responsibilities (SRP break); near-impossible to unit-test.
Progress (2026-06-18):
  - WaiterPassportSection: extracted the notification-prefs concern (7 useState + togglePush
    + saveNotifPrefs + push-check effect + its GET) into co-located `useNotifPrefs.ts`.
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
Remaining:
  - WaiterPassportSection: group profile-edit fields + sanitary book into reducers/hooks
    (optional polish — the 26→19 extraction already removed the worst SRP offender).
Note: the real god-component was WaiterPassportSection. The file-level useState counts for
  VenueSmeneSection/WaiterSmeneSection overstate the smell because those files are already
  sub-componentised — verify per-function complexity, not per-file totals.
Nodes: `WaiterPassportSection()`, `useNotifPrefs()` (new), `ShiftTemplateTab()` (migrated),
  `VenueSmeneSection()`, `WaiterSmeneSection()`.

### CQ-H — No data-fetching abstraction (root cause of CQ-G)  [FIXED]
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

### CQ-I — Silent error swallowing in API routes + components  [FIXED]
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

### CQ-J — console.* in lib modules vs logging convention  [FIXED]
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

### CQ-K — i18n speculative generality / YAGNI  [DEFERRED]
Severity: Important
Problem: full sr|en|ru translation stack (`lib/i18n/index.ts` 372 LOC + provider + 3 flag
  comps), but only the preloader page consumes it. Build-ahead-of-need maintenance weight.
Decision (2026-06-18, owner): DEFER — keep the infra, ticket a future rollout to wire
  dashboards. No code change now. Revisit when i18n rollout is scheduled.
Nodes: `translations`, `Lang`, `TranslationNamespace`, `FlagSwitcher()`, `LanguageProvider()`.

### CQ-L — Waiter dashboard spams 403 on /api/shifts?view=manage  [OPEN]
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

### CQ-M — CSP worker-src blocks service worker → web push dead  [OPEN]
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
  actual push *subscribe* additionally needs `NEXT_PUBLIC_VAPID_KEY` set + a real push service
  (not exercisable headless) — the CSP block that prevented SW registration is resolved.
Nodes: `next.config.ts` (`CSP`), `useNotifPrefs()` (`togglePush`), `/sw.js`.
