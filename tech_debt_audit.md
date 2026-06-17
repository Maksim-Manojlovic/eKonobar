# eKonobar — Technical Debt Audit Log

Graph-based code quality audit. Findings sourced from Graphify graph (`graphify-out/`) cross-referenced against current source. Append new findings with incremental IDs (`CQ-<letter>`). Statuses: `[OPEN]` · `[IN PROGRESS]` · `[FIXED]` · `[PARTIALLY FIXED]` · `[FALSE POSITIVE]` · `[WONTFIX]`.

> Note: this project has no prior `RentCheck` audit log. IDs start at `CQ-F` (the originating prompt referenced a RentCheck log ending at `CQ-E`; continued here for traceability).

## Status Table

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| CQ-F | Critical | Stale Graphify graph poisons graph-based audits | [FIXED] |
| CQ-G | Important | God-components: state-heavy dashboard sections | [OPEN] |
| CQ-H | Important | No data-fetching abstraction (root cause of CQ-G) | [OPEN] |
| CQ-I | Important | Silent error swallowing in API routes + components | [OPEN] |
| CQ-J | Nice-to-have | console.* in lib modules vs logging convention | [FIXED] |
| CQ-K | Important | i18n speculative generality / YAGNI | [OPEN] |

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

### CQ-G — God-components: state-heavy dashboard sections  [OPEN]
Severity: Important
Problem: section components hoard local state + inline fetching:
  - `WaiterPassportSection.tsx` — 26 useState, 12 fetch, 3 useEffect (701 LOC)
  - `VenueSmeneSection.tsx` — 17 useState, 7 fetch (706 LOC)
  - `WaiterSmeneSection.tsx` — 15 useState, 8 fetch (625 LOC)
  Single component owns many responsibilities (SRP break); near-impossible to unit-test.
Fix: useReducer per concern; extract sub-panels; move fetch lifecycles into custom hooks
  (depends on CQ-H landing first).
Nodes: `WaiterPassportSection()`, `VenueSmeneSection()`, `WaiterSmeneSection()`.

### CQ-H — No data-fetching abstraction (root cause of CQ-G)  [OPEN]
Severity: Important
Problem: no SWR/react-query/custom hook in deps; every section reimplements the
  loading/error/data useState triplet + manual fetch + manual refetch.
Fix: add thin `useApi<T>(url)` hook returning `{ data, error, isLoading, mutate }`;
  replace inline fetch+state. Cuts WaiterPassportSection ~26 → ~5 useState.
Nodes: all dashboard section components; cf. `useDashboardNav()` (nav state already abstracted).

### CQ-I — Silent error swallowing in API routes + components  [OPEN]
Severity: Important
Problem: empty `catch {}` / `.catch(() => {})` across ~9 files incl. data-path routes
  (`api/jobs/applications`, `api/waiters`, `api/notifications`, `api/admin/stats`).
  Swallowed exceptions hide failures, return success-shaped responses with stale/empty data.
Fix: split best-effort (cache bust → `logger.warn`) vs load-bearing (DB read → `logger.error`
  + propagate). No bare `catch {}`. Audit each site individually.
Nodes: `api/jobs/applications`, `api/waiters`, `api/notifications`, `api/admin/stats`,
  `api/payments/monri/cancel`.

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

### CQ-K — i18n speculative generality / YAGNI  [OPEN]
Severity: Important
Problem: full sr|en|ru translation stack (`lib/i18n/index.ts` 372 LOC + provider + 3 flag
  comps), but only the preloader page consumes it. Build-ahead-of-need maintenance weight.
Fix: product decision — (a) commit to rollout (wire dashboards), or (b) shrink `index.ts`
  to preloader keys + delete unused namespaces. Needs owner input before code change.
Nodes: `translations`, `Lang`, `TranslationNamespace`, `FlagSwitcher()`, `LanguageProvider()`.
