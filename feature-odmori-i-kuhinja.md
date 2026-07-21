# Odmori & Kitchen Staff — Design Plan

Status: **design approved, implementation not started**
Scope: two intertwined features — staff leave management ("Odmori" / "Slobodni dani") and kitchen-department staffing for restaurants.

They ship together because leave capacity must be counted **per department**: two waiters off is not the same as two cooks off. Building leave first and retrofitting departments would mean re-cutting the policy, blackout, and approval models.

---

## Part 0 — The blocking gap: there is no staff roster

Both features need to answer "who works here". The codebase currently cannot.

Today a venue's team is computed client-side in `src/app/(dashboard)/venue/page.tsx`:

```typescript
const acceptedWaiters = [...new Map(
  applications.filter(a => a.status === "ACCEPTED").map(a => [a.waiter.id, { ... }])
).values()];
```

This is derived from `JobApplication` and is wrong for anything durable:

| Problem | Consequence for leave |
|---|---|
| Staff hired off-platform (invite, walk-in, word of mouth) have no ACCEPTED application | No roster row → no leave balance → feature invisible to them |
| Moving an application to `COMPLETED` drops the person from the list | Active employee vanishes mid-year, balance orphaned |
| No `startedAt` | Cannot pro-rate first-year entitlement (Serbian 1/12-per-month rule) |
| No termination date | Ex-staff keep appearing in pickers and approval queues forever |
| No position/department | Cannot distinguish a cook from a waiter, cannot scope capacity |

**`VenueStaff` is the prerequisite for everything below.** It also independently fixes the shift-assignment picker and unlocks a real Team page.

---

## Part 1 — Kitchen staff (BOH)

### 1.1 Decision: no new `Role` enum value

`Role` has 197 references across `src/`, is carried in the JWT, and gates every route via `withRole`. Adding `Role.COOK` would fragment waiter search, the passport, trust scoring, and all seven `withRole("WAITER")` guards — and would force every existing user to re-login (per the JWT staleness rule in CLAUDE.md).

**Decision:** `Role.WAITER` is reinterpreted as the generic *hospitality worker* role (ugostiteljski radnik). A cook registers as `WAITER` at the auth layer and is distinguished by **position and department**, stored on the roster and the passport.

The `WaiterPassport` model keeps its name. Renaming it to `StaffPassport` is a mechanical 197-reference refactor with zero functional gain; it can happen later as its own change. UI copy shown to kitchen staff should read "Pasoš", not "Konobarski pasoš".

### 1.2 Position taxonomy

```prisma
enum StaffDepartment {
  FOH   // Sala — front of house
  BOH   // Kuhinja — back of house
}

enum StaffPosition {
  // FOH — Sala
  WAITER            // Konobar
  SENIOR_WAITER     // Iskusni konobar
  HEAD_WAITER       // Šef sale
  BARTENDER         // Šanker
  BARISTA           // Barista
  RUNNER            // Runner / pomoćni konobar
  HOST              // Hostesa
  SOMMELIER         // Somelijer

  // BOH — Kuhinja
  HEAD_CHEF         // Šef kuhinje
  SOUS_CHEF         // Su-šef / zamenik šefa kuhinje
  LINE_COOK         // Kuvar
  PREP_COOK         // Pomoćni kuvar
  PASTRY_CHEF       // Poslastičar
  GRILL_COOK        // Roštiljdžija
  DISHWASHER        // Perač suđa
}
```

`lib/staff/positions.ts` is the single source of truth mapping position → department + Serbian label. Department is **also stored** on `VenueStaff` (denormalized) so per-department queries stay indexable, but it is always derived and validated on write — a `FOH` + `HEAD_CHEF` row must be impossible.

```typescript
// lib/staff/positions.ts
export const POSITION_DEPARTMENT: Record<StaffPosition, StaffDepartment> = { ... };
export const POSITION_LABELS: Record<StaffPosition, string> = { HEAD_CHEF: "Šef kuhinje", ... };
export const FOH_POSITIONS: StaffPosition[] = [...];
export const BOH_POSITIONS: StaffPosition[] = [...];
export function departmentOf(p: StaffPosition): StaffDepartment;
```

### 1.3 Which venues get a kitchen

The user's requirement is "restaurants only", but `HOTEL` and `CATERING` self-evidently have kitchens too. Gate on a derived helper with an explicit per-venue override:

```typescript
// lib/staff/positions.ts
const KITCHEN_VENUE_TYPES: VenueType[] = ["RESTAURANT", "HOTEL", "CATERING"];

export function hasKitchen(venue: { venueType: VenueType; kitchenEnabled: boolean | null }): boolean {
  return venue.kitchenEnabled ?? KITCHEN_VENUE_TYPES.includes(venue.venueType);
}
```

New column `Venue.kitchenEnabled Boolean?` — `null` means "derive from venue type", an explicit value overrides. This covers the bar that started serving food and the restaurant that outsources its kitchen, without either needing a schema change.

**When `hasKitchen()` is false the entire kitchen surface is absent**, not disabled: no department tabs, no BOH positions in pickers, no BOH policy row, no Kuhinja column in the leave calendar. A café owner must not see a feature that does not apply to them.

### 1.4 Šef kuhinje — authorization

`Venue.headWaiterId` already exists and grants shift-management rights via `lib/shifts/auth.ts`. Add the symmetric `Venue.headChefId`, and scope both by department.

| Actor | Can manage |
|---|---|
| `VENUE_OWNER` (owner of venue) | All shifts, all leave, both departments |
| `headWaiterId` | FOH shifts + FOH leave only |
| `headChefId` | BOH shifts + BOH leave only |

This requires `Shift.department StaffDepartment?` (nullable for legacy rows; treated as FOH). Without it a head chef could edit sala shifts and vice versa.

`lib/shifts/auth.ts` extends rather than forks:

```typescript
export function canManageShifts(
  userId: string,
  role: string,
  venue: { ownerId: string; headWaiterId: string | null; headChefId: string | null },
  department?: StaffDepartment | null,   // omit = "any department" (list views)
): boolean
```

Existing call sites keep working (department omitted → current behaviour). Routes that mutate a specific shift pass `shift.department`.

**Migration note:** every existing `Shift` row predates this field. Backfill to `FOH` in the migration, since every venue on the platform today is staffed front-of-house only.

### 1.5 Downstream surfaces that must learn about departments

| Surface | Change |
|---|---|
| `JobPost` | Add `position StaffPosition?` + `department StaffDepartment?`. Kitchen jobs must be findable as kitchen jobs. |
| `GET /api/waiters` | New `position=` and `department=` filters. Add via `buildWaiterQuery`/`WaiterFilters` in `hooks/useWaiterSearch.ts` so all three search clients inherit them (per CLAUDE.md). |
| `WaiterPassport` | Add `positions StaffPosition[]` — what this person can do, independent of any one venue. Drives search. |
| `Shift` | Add `department`; the free-text `Shift.role` stays for display but the enum drives filtering. |
| Sanitary book | Food handling makes a sanitary book legally mandatory in Serbia. BOH job posts default `sanitaryRequired: true`. |
| Red Alert broadcast | `broadcastRedAlert` should match on position, not just municipality — a Red Alert for a grill cook should not wake every waiter in Vračar. |

---

## Part 2 — Odmori (leave management)

### 2.1 Core model

```prisma
enum LeaveType   { ANNUAL SICK UNPAID PARENTAL SPECIAL }
enum LeaveStatus { PENDING APPROVED REJECTED CANCELLED }
enum StaffStatus { ACTIVE SUSPENDED ENDED }

model VenueStaff {
  id       String @id @default(cuid())
  venueId  String
  venue    Venue  @relation(fields: [venueId], references: [id])
  waiterId String
  waiter   User   @relation("VenueStaffMember", fields: [waiterId], references: [id])

  position       StaffPosition
  department     StaffDepartment   // derived from position, validated on write
  status         StaffStatus       @default(ACTIVE)
  employmentType EngagementType
  startedAt      DateTime
  endedAt        DateTime?

  leaveBalances LeaveBalance[]
  leaveRequests LeaveRequest[]

  @@unique([venueId, waiterId])
  @@index([venueId, status])
  @@index([venueId, department, status])
  @@index([waiterId])
}

model LeavePolicy {
  id         String @id @default(cuid())
  venueId    String
  venue      Venue  @relation(fields: [venueId], references: [id])
  department StaffDepartment

  annualDays        Int     @default(26)
  maxConcurrentOff  Int     @default(2)
  minNoticeDays     Int     @default(14)
  autoApprove       Boolean @default(true)
  countWeekends     Boolean @default(true)
  allowCarryOver    Boolean @default(true)
  carryOverDays     Int     @default(5)
  carryOverDeadline String  @default("06-30")   // MM-DD

  @@unique([venueId, department])
}

model LeaveBalance {
  id      String     @id @default(cuid())
  staffId String
  staff   VenueStaff @relation(fields: [staffId], references: [id], onDelete: Cascade)
  year    Int

  entitledDays  Float          // pro-rated when startedAt is mid-year
  carriedInDays Float @default(0)
  usedDays      Float @default(0)   // APPROVED ANNUAL only
  pendingDays   Float @default(0)   // PENDING ANNUAL — reserved, prevents overbooking
  sickDaysTaken Float @default(0)   // tracked, never deducted from annual

  @@unique([staffId, year])
}

model LeaveRequest {
  id      String     @id @default(cuid())
  staffId String
  staff   VenueStaff @relation(fields: [staffId], references: [id], onDelete: Cascade)

  // Denormalized for indexed calendar queries without a join
  venueId    String
  waiterId   String
  department StaffDepartment

  type      LeaveType   @default(ANNUAL)
  startDate DateTime    @db.Date
  endDate   DateTime    @db.Date
  days      Float                    // computed server-side, never trusted from client
  status    LeaveStatus @default(PENDING)

  reason        String? @db.Text
  attachmentUrl String?              // doznaka / doctor's note for SICK

  createdById  String                // owner may file SICK on a worker's behalf
  reviewedById String?
  reviewedAt   DateTime?
  rejectReason String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([venueId, department, startDate])
  @@index([waiterId, status])
  @@index([status])
}

model VenueBlackoutDate {
  id         String          @id @default(cuid())
  venueId    String
  venue      Venue           @relation(fields: [venueId], references: [id])
  department StaffDepartment
  date       DateTime        @db.Date

  maxOff Int     @default(0)   // 0 = fully blocked ("X"), >0 = reduced cap
  reason String?

  @@unique([venueId, department, date])
  @@index([venueId, date])
}
```

### 2.2 Sparse blackouts — days are free by default

Only non-default days are stored. A venue that blocks 30 days a year has 30 rows per department, not 365. Absence of a row means "normal policy applies", which is the desired default of *everything is available*.

### 2.3 Capacity, not a binary block

A pure on/off X solves "everyone works New Year's Eve" but not "three cooks all want 15 July". So a blackout row carries a **number**:

```
effectiveMaxOff(venueId, department, date) =
  blackoutRow?.maxOff ?? policy(venueId, department).maxConcurrentOff
```

The owner's X button writes `maxOff: 0`. The same UI can also set `maxOff: 1` for "one person off, first come first served". Identical one-click UX, far stronger semantics.

Capacity is counted **within a department**. Two waiters off does not consume the kitchen's allowance.

### 2.4 Auto-approve by default

Because the design premise is "everything free unless the owner says otherwise", most requests should never reach a human:

```
if (autoApprove && !blackoutBlocks && capacityAvailable && noticeOk && balanceOk)
    → APPROVED immediately, notify the manager
else
    → PENDING, enters the approval queue
```

`autoApprove` is per-department policy, default on. This is the difference between a feature owners use and one they abandon.

### 2.5 Sick leave is a different thing

Under Serbian labour law bolovanje is not deducted from godišnji odmor: separate accrual, requires a doznaka, and the employer pays the first 30 days. Therefore:

- `SICK` never touches `usedDays`; it increments `sickDaysTaken`.
- `SICK` **bypasses blackout and capacity checks** — a sick person cannot be ordered in.
- `SICK` may be created by the manager on the worker's behalf (the stated requirement) or by the worker with an attachment, then confirmed.
- Retroactive dates are allowed for `SICK` and rejected for `ANNUAL`.

### 2.6 Entitlement: 26 days is a default, not a constant

Serbian `Zakon o radu` čl. 69 sets the statutory minimum at 20 working days; 26 is above it and is a reasonable house default. It stays configurable per venue **and per department** — kitchens and floors commonly negotiate differently.

First-year pro-rating follows the 1/12-per-month rule:

```
entitledDays = round(policy.annualDays * monthsWorkedInYear / 12)
```

### 2.7 Day counting — one rule, written down

`countWeekends: true` by default. Hospitality staff work weekends; silently skipping Saturday and Sunday would gift free days and make the 26 meaningless. Days are counted as **calendar days in the requested range**, computed server-side. A client-supplied `days` value is never trusted.

Ranges that cross 31 December are **split into two requests**, each deducting from its own leave year.

---

## Part 3 — Integration with the shift system

Leave that does not block scheduling is decoration. Touch points:

| File | Change |
|---|---|
| `POST /api/shifts` | Warn (not block) when an assigned worker has approved leave on that date — an owner may knowingly override |
| `POST /api/shifts/templates/[id]/generate` | Skip or flag generated dates where the intended assignee is on leave |
| `POST /api/shifts/[id]/claim` | **Hard block** — a worker on approved leave cannot claim an open shift |
| `POST /api/shifts/[id]/swap` | 409 when the swap target is on leave |
| Leave approval | Return the list of conflicting shift assignments; the manager confirms unassignment explicitly |

Asymmetry is deliberate: managers get a warning they can override, workers get a hard stop.

---

## Part 4 — Concurrency

Two approvals racing into the last capacity slot would overbook. `@@unique` cannot express "count ≤ N".

**Approach:** perform the capacity re-check and the balance mutation inside a single `db.$transaction`, taking a row lock on the blackout/policy row (`SELECT ... FOR UPDATE`) as the serialization point. This is correct without Redis, which matters because Redis is optional in development.

An `acquireLock("leave:approve:{venueId}:{department}:{date}")` fast path may be layered on top, but the standing project rule "fail open on `reason: unavailable`" does **not** apply here — this is a correctness lock, not an availability lock, so the transaction must remain the real guarantee.

The `pendingDays` reservation is incremented in the same transaction that creates the request, so two concurrent requests cannot both fit into one remaining day.

---

## Part 5 — API surface

| Route | Role | Purpose |
|---|---|---|
| `GET/POST /api/venues/[id]/staff` | owner | Roster CRUD; POST backfills from ACCEPTED applications |
| `PATCH /api/venues/[id]/staff/[staffId]` | owner | End employment, change position/type |
| `GET/PATCH /api/leave/policy?venueId&department` | owner | Policy config |
| `GET /api/leave/blackouts?venueId&department&from&to` | auth | Calendar shading (workers need read access) |
| `POST /api/leave/blackouts` | owner, head of dept | Bulk range → rows |
| `DELETE /api/leave/blackouts` | owner, head of dept | Un-X a range |
| `GET /api/leave/requests` | both | Manager → venue queue; worker → own requests |
| `POST /api/leave/requests` | worker + manager | Create (manager only for SICK-on-behalf) |
| `PATCH /api/leave/requests/[id]` | manager / worker | Approve, reject, or worker-cancel |
| `GET /api/leave/balance?year` | worker | Balance ring data |
| `GET /api/leave/calendar?venueId&department&from&to` | manager | Merged view: blackouts + approved + pending per day |

All routes follow existing conventions: `withRole`/`withAuth`, `parseBody`/`parseQuery` with Zod, `fireSideEffects` for notifications, `checkRateLimit(userId, "create_leave_request", 10)`.

---

## Part 6 — UI

### Worker — new "Odmori" section

Registered in `waiter-types.ts` (`Section`), `waiter-constants.ts` (`SECTION_TITLES`), and the `waiterNav` i18n namespace.

- Balance ring: `entitled + carriedIn − used − pending` remaining
- 12-month year grid, colour-coded: free / blocked / my approved / my pending / at capacity
- Tap a day or drag a range → request modal (type, reason, attachment for SICK)
- Request list with status badges; cancel button on PENDING
- Venue selector when the worker is on more than one roster

### Manager — new "Odmori" section, three tabs

- **Zahtevi** — approval queue, one-tap Odobri/Odbij, conflicting shifts shown inline
- **Kalendar** — year grid; click a day to X it, drag for a range, per-day `N off / cap` counter. Department switcher (Sala / Kuhinja) when `hasKitchen(venue)`
- **Tim** — table of worker × entitled / used / pending / remaining / sick, plus "Dodaj bolovanje"

Reuse per CLAUDE.md: `Sk` skeletons, `useApi` for GETs, one grouped form-state object with a `setField` updater (never one `useState` per field), and `LEAVE_STATUS_COLORS` / `LEAVE_TYPE_LABELS` / `POSITION_LABELS` / `DEPARTMENT_LABELS` in `lib/formatting/display-maps.ts`.

---

## Part 7 — Notifications

New `NotificationType` values: `LEAVE_REQUESTED`, `LEAVE_RESOLVED`, `LEAVE_CANCELLED`.

Per CLAUDE.md, adding an enum value also requires:
- an icon in `TYPE_ICONS` (`components/ui/NotificationBell.tsx`)
- an entry in `FILTER_MAP` / `FILTER_GROUPS` (`components/ui/NotificationsSection.tsx`) — a new "Odmori" chip

Routing: `LEAVE_REQUESTED` goes to the owner **and** to the head of the relevant department. `LEAVE_RESOLVED` goes to the worker.

---

## Part 8 — Edge cases and their resolutions

1. **Worker on two rosters.** Balance is per-venue. Leave at venue A does not block a shift at venue B. Correct, but confusing — the worker UI needs an explicit venue selector.
2. **Range spanning New Year.** Split into two requests at the boundary; each deducts from its own year.
3. **Owner blocks a day that already has approved leave.** Never auto-revoke. Show the conflict; the owner revokes manually.
4. **Worker leaves mid-year with unused days.** `endedAt` set, balance frozen; payout is handled off-platform.
5. **Carry-over expiry.** A cron zeroes unused `carriedInDays` at `carryOverDeadline`. Use `isCronAuthorized` from `lib/auth/cron-auth.ts`.
6. **Position change (Kuvar → Šef kuhinje).** Update `VenueStaff.position`; the balance follows the staff row, not the position. A department change (FOH → BOH) mid-year keeps the same balance row.
7. **Head chef requests their own leave.** Falls to the owner — a manager may not approve their own request. Enforce explicitly.
8. **Venue turns off its kitchen** (`kitchenEnabled: false`) with BOH staff on the roster. Block the change; require the roster to be emptied or reassigned first.
9. **Rate limiting.** `create_leave_request`, 10/hour, via `checkRateLimit`.

---

## Part 9 — Phasing

| Phase | Scope | Est. |
|---|---|---|
| **1** | `StaffPosition`/`StaffDepartment` enums, `lib/staff/positions.ts`, `VenueStaff`, `Venue.kitchenEnabled` + `headChefId`, backfill script from ACCEPTED applications | 3 d |
| **2** | Manager **Tim** tab: roster CRUD, position assignment, department grouping | 2 d |
| **3** | `LeavePolicy` + `VenueBlackoutDate` + **Kalendar** blackout editor | 2 d |
| **4** | `LeaveRequest` + `LeaveBalance` + approval flow + worker **Odmori** section | 5 d |
| **5** | Shift-system guards (claim / create / swap / template generate), department scoping in `lib/shifts/auth.ts` | 2 d |
| **6** | SICK type, attachment upload via `POST /api/upload`, manager-on-behalf filing | 2 d |
| **7** | Notifications, carry-over cron, department filters on `GET /api/waiters` and `JobPost` | 2 d |

Roughly 18 working days. Phases 1 and 2 have standalone value — a real staff roster with kitchen positions is useful even if leave slips.

---

## Appendix — Naming note

The codebase says "waiter" throughout because the platform launched front-of-house only. After Phase 1 the term is inaccurate: `WaiterPassport` holds cooks, `withRole("WAITER")` guards kitchen routes, and `GET /api/waiters` returns chefs.

This is accepted debt, deliberately not paid down here. A rename touches 197 references and would bury the feature diff. It should be a separate, mechanical, single-purpose change. Until then, treat `WAITER` as meaning *hospitality worker* and keep user-facing Serbian copy neutral ("Pasoš", "Osoblje", "Radnik") rather than "Konobar" on any surface a cook can see.
