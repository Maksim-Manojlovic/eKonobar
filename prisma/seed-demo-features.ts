/**
 * Feature seed — layers staff rosters, leave, shifts, applications, reviews,
 * engagements and notifications onto the venues already created by
 * `seed-demo.ts`. Run that first, then this.
 *
 *   npx tsx prisma/seed-demo.ts
 *   npx tsx prisma/seed-demo-features.ts
 *
 * Idempotent: every row it writes is scoped to the demo owner's venues and the
 * demo waiters, and it deletes its prior output before re-inserting. It never
 * touches non-demo data.
 *
 * DOUBLE-CHECK which database DATABASE_URL points at before running.
 */
import { PrismaClient, type StaffPosition, type StaffDepartment } from "@prisma/client";
import { departmentOf, hasKitchen, FOH_POSITIONS, BOH_POSITIONS } from "../src/lib/staff/positions";
import { countLeaveDays, parseDateOnly } from "../src/lib/leave/dates";

const db = new PrismaClient();
const DEMO_DOMAIN = "demo.ekonobar.rs";
const YEAR = 2026;

const pick = <T>(arr: T[], i: number) => arr[i % arr.length];
const date = (s: string) => parseDateOnly(s)!;
/** N days from a base date, as a Date. */
const plusDays = (base: Date, n: number) => new Date(base.getTime() + n * 86_400_000);
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const owner = await db.user.findUnique({
    where: { email: `owner@${DEMO_DOMAIN}` },
    select: { id: true },
  });
  if (!owner) throw new Error("Run seed-demo.ts first — owner@demo.ekonobar.rs not found.");

  const venues = await db.venue.findMany({
    where: { ownerId: owner.id },
    select: { id: true, name: true, venueType: true, kitchenEnabled: true },
    orderBy: { createdAt: "asc" },
  });
  const venueIds = venues.map(v => v.id);

  const waiters = await db.user.findMany({
    where: { email: { endsWith: `@${DEMO_DOMAIN}` }, role: "WAITER" },
    select: { id: true, name: true },
    orderBy: { email: "asc" },
  });

  const posts = await db.jobPost.findMany({
    where: { venueId: { in: venueIds } },
    select: { id: true, venueId: true, engagementType: true },
  });

  // ── Clean prior feature output (scoped to these venues) ────────────────────
  const staffRows = await db.venueStaff.findMany({ where: { venueId: { in: venueIds } }, select: { id: true } });
  const staffIds = staffRows.map(s => s.id);

  await db.leaveRequest.deleteMany({ where: { venueId: { in: venueIds } } });
  await db.leaveBalance.deleteMany({ where: { staffId: { in: staffIds } } });
  await db.leavePolicy.deleteMany({ where: { venueId: { in: venueIds } } });
  await db.venueBlackoutDate.deleteMany({ where: { venueId: { in: venueIds } } });
  await db.shiftSwapRequest.deleteMany({ where: { shift: { venueId: { in: venueIds } } } });
  await db.shiftAssignment.deleteMany({ where: { shift: { venueId: { in: venueIds } } } });
  await db.shift.deleteMany({ where: { venueId: { in: venueIds } } });
  await db.venueStaff.deleteMany({ where: { venueId: { in: venueIds } } });
  await db.jobApplication.deleteMany({ where: { jobPost: { venueId: { in: venueIds } } } });
  await db.engagementRecord.deleteMany({ where: { venueId: { in: venueIds } } });
  await db.review.deleteMany({ where: { venueId: { in: venueIds } } });
  await db.notification.deleteMany({ where: { userId: owner.id } });
  // Reset the head pointers so re-runs start clean.
  await db.venue.updateMany({ where: { id: { in: venueIds } }, data: { headWaiterId: null, headChefId: null } });

  // ── 1. Staff rosters ───────────────────────────────────────────────────────
  // Each venue gets a FOH crew; kitchen venues also get a BOH crew. Waiters are
  // reused across venues on purpose — waiter11 and waiter16 land on several, to
  // show the per-venue balance in the waiter Odmori view.
  let wi = 0;                       // rolling index into the waiter pool
  const nextWaiter = () => waiters[(wi++) % waiters.length];

  type StaffSeed = { id: string; venueId: string; waiterId: string; department: StaffDepartment };
  const allStaff: StaffSeed[] = [];
  let created = { staff: 0, foh: 0, boh: 0 };

  for (const v of venues) {
    const kitchen = hasKitchen(v);
    const usedHere = new Set<string>();

    const addCrew = async (positions: StaffPosition[], count: number) => {
      for (let k = 0; k < count; k++) {
        // Avoid the (venueId, waiterId) unique clash within a venue.
        let w = nextWaiter();
        let guard = 0;
        while (usedHere.has(w.id) && guard++ < waiters.length) w = nextWaiter();
        usedHere.add(w.id);

        const position = k === 0 ? positions[0] : pick(positions.slice(1), k);
        const department = departmentOf(position);
        const monthsBack = 6 + ((wi + k) % 30); // started 6–36 months ago → full entitlement
        const row = await db.venueStaff.create({
          data: {
            venueId: v.id,
            waiterId: w.id,
            position,
            department,
            status: "ACTIVE",
            employmentType: "FULL_TIME",
            startedAt: new Date(Date.UTC(YEAR - (monthsBack > 12 ? 2 : 1), (12 - (monthsBack % 12)) % 12, 1)),
          },
          select: { id: true },
        });
        allStaff.push({ id: row.id, venueId: v.id, waiterId: w.id, department });
        created.staff++;
        if (department === "BOH") created.boh++; else created.foh++;

        // Head roles drive the venue's management pointers.
        if (position === "HEAD_WAITER") await db.venue.update({ where: { id: v.id }, data: { headWaiterId: w.id } });
        if (position === "HEAD_CHEF")   await db.venue.update({ where: { id: v.id }, data: { headChefId: w.id } });
      }
    };

    await addCrew(FOH_POSITIONS, 5);           // šef sale + 4 floor
    if (kitchen) await addCrew(BOH_POSITIONS, 3); // šef kuhinje + 2 cooks
  }

  // ── 2. Leave policy + blackout calendar (showcase on the first venue) ───────
  const showcase = venues[0]; // Kafana Stari Grad — RESTAURANT, has a kitchen
  await db.leavePolicy.create({
    data: {
      venueId: showcase.id, department: "FOH",
      annualDays: 25, maxConcurrentOff: 2, minNoticeDays: 14, autoApprove: true,
    },
  });
  await db.leavePolicy.create({
    data: {
      venueId: showcase.id, department: "BOH",
      annualDays: 22, maxConcurrentOff: 1, minNoticeDays: 21, autoApprove: false,
    },
  });
  // New Year's Eve + Day fully blocked; a summer week capped to one person off.
  const blackouts = [
    { date: date(`${YEAR}-12-31`), maxOff: 0, reason: "Doček Nove godine" },
    { date: date(`${YEAR + 1}-01-01`), maxOff: 0, reason: "Nova godina" },
    ...["08-10", "08-11", "08-12", "08-13", "08-14"].map(d => ({
      date: date(`${YEAR}-${d}`), maxOff: 1, reason: "Sezona — najviše 1 slobodan",
    })),
  ];
  for (const b of blackouts) {
    await db.venueBlackoutDate.create({ data: { venueId: showcase.id, department: "FOH", ...b } });
  }

  // ── 3. Leave balances for every staff member, + showcase requests ──────────
  // Base balance for everyone so the waiter Odmori ring always has data.
  for (const s of allStaff) {
    await db.leaveBalance.create({
      data: {
        staffId: s.id, year: YEAR,
        entitledDays: 26, carriedInDays: 3, usedDays: 4 + ((wi + s.venueId.length) % 4),
      },
    });
  }

  // Rich request history on the showcase venue's FOH crew, one span per state.
  const showcaseStaff = allStaff.filter(s => s.venueId === showcase.id && s.department === "FOH");
  const today = date(iso(new Date()));

  type ReqSeed = {
    staff: StaffSeed; type: "ANNUAL" | "SICK"; from: string; to: string;
    status: "APPROVED" | "PENDING" | "REJECTED"; autoApproved?: boolean;
    reason?: string; rejectReason?: string;
  };
  const requests: ReqSeed[] = [
    { staff: showcaseStaff[1], type: "ANNUAL", from: `${YEAR}-06-02`, to: `${YEAR}-06-06`, status: "APPROVED", autoApproved: true, reason: "Porodično putovanje" },
    { staff: showcaseStaff[2], type: "ANNUAL", from: iso(plusDays(today, 5)), to: iso(plusDays(today, 8)), status: "PENDING", reason: "Kratka pauza" },
    { staff: showcaseStaff[3], type: "ANNUAL", from: `${YEAR}-09-10`, to: `${YEAR}-09-14`, status: "APPROVED", autoApproved: true },
    { staff: showcaseStaff[1], type: "SICK",   from: `${YEAR}-07-15`, to: `${YEAR}-07-17`, status: "APPROVED", reason: "Prehlada (doznaka)" },
    { staff: showcaseStaff[2], type: "ANNUAL", from: `${YEAR}-08-15`, to: `${YEAR}-08-20`, status: "REJECTED", rejectReason: "Sezona je, potrebni ste u lokalu" },
  ];

  let leaveCount = 0;
  for (const r of requests) {
    if (!r.staff) continue;
    const from = date(r.from), to = date(r.to);
    const days = countLeaveDays(from, to, true);
    await db.leaveRequest.create({
      data: {
        staffId: r.staff.id, venueId: showcase.id, waiterId: r.staff.waiterId,
        department: r.staff.department, type: r.type,
        startDate: from, endDate: to, year: YEAR, days,
        status: r.status, autoApproved: r.autoApproved ?? false,
        reason: r.reason ?? null, rejectReason: r.rejectReason ?? null,
        createdById: r.type === "SICK" ? owner.id : r.staff.waiterId,
        reviewedById: r.status === "PENDING" ? null : owner.id,
        reviewedAt: r.status === "PENDING" ? null : new Date(),
      },
    });
    // Keep balances consistent with the requests shown.
    if (r.status === "APPROVED" && r.type === "ANNUAL") {
      await db.leaveBalance.update({ where: { staffId_year: { staffId: r.staff.id, year: YEAR } }, data: { usedDays: { increment: days } } });
    } else if (r.status === "PENDING" && r.type === "ANNUAL") {
      await db.leaveBalance.update({ where: { staffId_year: { staffId: r.staff.id, year: YEAR } }, data: { pendingDays: { increment: days } } });
    } else if (r.status === "APPROVED" && r.type === "SICK") {
      await db.leaveBalance.update({ where: { staffId_year: { staffId: r.staff.id, year: YEAR } }, data: { sickDaysTaken: { increment: days } } });
    }
    leaveCount++;
  }

  // ── 4. Shifts — next two weeks on the first three venues ────────────────────
  let shiftCount = 0;
  for (const v of venues.slice(0, 3)) {
    const crew = allStaff.filter(s => s.venueId === v.id && s.department === "FOH");
    for (let d = 0; d < 14; d += 2) {
      const day = plusDays(today, d);
      const assignee = crew[(d / 2) % crew.length];
      const isOpen = d % 6 === 0; // roughly every third shift left open for the marketplace
      const scheduledStart = new Date(`${iso(day)}T18:00:00Z`);

      const shift = await db.shift.create({
        data: {
          venueId: v.id,
          title: pick(["Večernja smena", "Popodnevna smena", "Vikend smena"], d),
          date: day, startTime: "18:00", endTime: "02:00",
          scheduledStart, department: "FOH",
          requiredCount: 1, pay: 4000 + (d % 3) * 500,
          tipEstimate: 2000 + (d % 4) * 500,
          status: isOpen ? "OPEN" : "ASSIGNED",
          assignments: isOpen ? undefined : { create: { waiterId: assignee.waiterId } },
        },
      });

      // A couple of past shifts get a recorded clock-in for realism.
      if (d >= 8 && !isOpen) {
        await db.shiftAssignment.updateMany({
          where: { shiftId: shift.id },
          data: { clockInAt: scheduledStart, clockInMethod: "GPS", lateMinutes: d % 3 === 0 ? 6 : 0 },
        });
      }
      shiftCount++;
    }
  }

  // ── 5. Job applications across the pipeline ─────────────────────────────────
  const APP_STATES = ["PENDING", "PENDING", "SHORTLISTED", "ACCEPTED", "COMPLETED", "REJECTED"] as const;
  let appCount = 0;
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    // 2–3 applicants per post, distinct waiters, distinct from each other.
    for (let a = 0; a < 3; a++) {
      const w = waiters[(i * 3 + a + 7) % waiters.length];
      const status = pick(APP_STATES as unknown as string[], i + a);
      try {
        await db.jobApplication.create({
          data: {
            jobPostId: post.id, waiterId: w.id,
            status: status as (typeof APP_STATES)[number],
            coverNote: "Zainteresovan sam za poziciju, imam iskustva u ugostiteljstvu.",
            appliedAt: plusDays(today, -(i + a + 1)),
          },
        });
        appCount++;
        // Completed applications leave a verified engagement record.
        if (status === "COMPLETED") {
          await db.engagementRecord.create({
            data: {
              waiterId: w.id, venueId: post.venueId, jobPostId: post.id,
              startDate: plusDays(today, -120), endDate: plusDays(today, -10),
              engagementType: post.engagementType, verified: true, verifiedAt: new Date(),
            },
          });
        }
      } catch { /* unique (jobPostId, waiterId) — skip dupes */ }
    }
  }

  // ── 6. Reviews — published, both venue-facing directions ────────────────────
  let reviewCount = 0;
  const COMMENTS = [
    "Odlična atmosfera i korektna isplata.", "Organizacija smena može biti bolja.",
    "Sjajan tim, preporučujem.", "Gužva vikendom, ali dobra zarada.",
    "Ljubazno osoblje, brza usluga.", "Prijatan ambijent, doći ćemo opet.",
  ];
  for (let i = 0; i < venues.length; i++) {
    const v = venues[i];
    const author = waiters[(i + 3) % waiters.length];
    // Waiter → venue
    await db.review.create({
      data: {
        authorId: author.id, venueId: v.id, direction: "WAITER_TO_VENUE",
        status: "PUBLISHED", overallRating: 60 + (i * 7) % 40, comment: pick(COMMENTS, i),
        ratingAtmosphere: 70 + (i % 5) * 5, ratingOrganization: 60 + (i % 6) * 5,
        ratingPay: 65 + (i % 4) * 6, ratingTips: 55 + (i % 5) * 6,
        ratingHygieneWork: 70 + (i % 3) * 8, ratingManagement: 60 + (i % 4) * 7,
        publishedAt: plusDays(today, -(i + 2)),
      },
    });
    // Guest → venue (anonymous)
    await db.review.create({
      data: {
        authorId: null, guestHandle: "Gost", venueId: v.id, direction: "GUEST_TO_VENUE",
        status: "PUBLISHED", overallRating: 70 + (i * 5) % 30, comment: pick(COMMENTS, i + 2),
        ratingAtmosphere: 75 + (i % 4) * 5, ratingOrganization: 65 + (i % 5) * 5,
        ratingHygieneWork: 72 + (i % 3) * 6,
        publishedAt: plusDays(today, -(i + 1)),
      },
    });
    reviewCount += 2;
  }

  // ── 7. Owner notifications (unread → bell badge shows) ──────────────────────
  const notifs = [
    { type: "APPLICATION_RECEIVED" as const, title: "Nova prijava", body: "Marko Nikolić se prijavio na oglas Konobar.", link: "/venue" },
    { type: "LEAVE_REQUESTED" as const, title: "Zahtev za odmor", body: "Član tima traži godišnji odmor — čeka vašu odluku.", link: "/venue" },
    { type: "REVIEW_RECEIVED" as const, title: "Nova recenzija", body: "Gost je ocenio vaš lokal.", link: "/venue" },
    { type: "SHIFT_CLAIMED" as const, title: "Smena preuzeta", body: "Konobar je preuzeo otvorenu smenu.", link: "/venue" },
  ];
  for (const n of notifs) {
    await db.notification.create({ data: { userId: owner.id, ...n, read: false } });
  }

  console.log("Feature seed complete:");
  console.log(`  staff:        ${created.staff}  (${created.foh} FOH, ${created.boh} BOH) across ${venues.length} venues`);
  console.log(`  leave policy: 2 (showcase venue), blackouts: ${blackouts.length}`);
  console.log(`  leave:        ${leaveCount} requests, balances for all staff`);
  console.log(`  shifts:       ${shiftCount}  applications: ${appCount}  reviews: ${reviewCount}`);
  console.log(`  notifications:${notifs.length} unread for owner`);
  console.log(`\nLog in: owner@${DEMO_DOMAIN} / Demo1234!`);
  console.log(`Head-waiter view: log in as the head waiter of "${showcase.name}" to see manage + own leave.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
