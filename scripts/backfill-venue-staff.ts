#!/usr/bin/env node
/**
 * Seed the `VenueStaff` roster from existing data, so venues that were on the
 * platform before the roster existed do not start with an empty team.
 *
 * Before `VenueStaff`, a venue's team was derived client-side from ACCEPTED
 * JobApplications. This script makes that derivation durable, and adds two
 * sources it missed:
 *
 *   1. ACCEPTED / COMPLETED JobApplications  → position from the job post
 *   2. Verified EngagementRecords            → accurate startedAt + employment type
 *   3. Venue.headWaiterId                    → HEAD_WAITER, even with no application
 *
 * Precedence when a waiter appears in several sources: the *earliest* startDate
 * wins (that is when they actually began), and an explicit head-waiter role beats
 * a position guessed from a job title.
 *
 * Everyone is seeded as FOH. No BOH staff can predate this change — kitchen
 * positions did not exist. Owners reassign cooks from the Tim tab afterwards.
 *
 * DRY RUN BY DEFAULT — prints what it would create and touches nothing. Apply
 * with `--apply`. Runs against whatever `DATABASE_URL` points at, so check you
 * are aiming at the intended database first:
 *
 *   npx tsx scripts/backfill-venue-staff.ts            # preview
 *   npx tsx scripts/backfill-venue-staff.ts --apply    # write
 *
 * Idempotent: skips any (venueId, waiterId) that already has a roster row, so
 * re-running after a partial failure is safe.
 */
import { PrismaClient, type EngagementType, type StaffPosition } from "@prisma/client";
import { departmentOf } from "../src/lib/staff/positions";

const APPLY = process.argv.includes("--apply");
const db = new PrismaClient();

type Candidate = {
  venueId:        string;
  venueName:      string;
  waiterId:       string;
  waiterName:     string;
  position:       StaffPosition;
  employmentType: EngagementType;
  startedAt:      Date;
  source:         string;
};

const key = (c: { venueId: string; waiterId: string }) => `${c.venueId}::${c.waiterId}`;

/**
 * Guess a position from a free-text job title. Deliberately conservative — only
 * unambiguous Serbian/English keywords map, everything else falls back to WAITER
 * and the owner corrects it. A wrong guess here is worse than a boring default:
 * it silently mislabels someone's role on their own roster.
 */
function positionFromTitle(title: string): StaffPosition {
  const t = title.toLowerCase();
  if (t.includes("šef sale") || t.includes("sef sale"))   return "HEAD_WAITER";
  if (t.includes("šanker")   || t.includes("sanker")
   || t.includes("bartender"))                            return "BARTENDER";
  if (t.includes("barista"))                              return "BARISTA";
  if (t.includes("somelijer") || t.includes("sommelier")) return "SOMMELIER";
  if (t.includes("hostesa")  || t.includes("host"))       return "HOST";
  if (t.includes("runner"))                               return "RUNNER";
  return "WAITER";
}

/** Keep the record that starts earliest; break ties in favour of a head role. */
function preferred(a: Candidate, b: Candidate): Candidate {
  if (a.position === "HEAD_WAITER" && b.position !== "HEAD_WAITER") return a;
  if (b.position === "HEAD_WAITER" && a.position !== "HEAD_WAITER") return b;
  return a.startedAt <= b.startedAt ? a : b;
}

async function collect(): Promise<Map<string, Candidate>> {
  const found = new Map<string, Candidate>();
  const add = (c: Candidate) => {
    const k = key(c);
    const existing = found.get(k);
    found.set(k, existing ? preferred(existing, c) : c);
  };

  // ── 1. Job applications the venue accepted or completed ────────────────────
  const applications = await db.jobApplication.findMany({
    where: { status: { in: ["ACCEPTED", "COMPLETED"] } },
    select: {
      appliedAt: true,
      waiter:  { select: { id: true, name: true, role: true } },
      jobPost: {
        select: {
          title: true, engagementType: true, startDate: true,
          venue: { select: { id: true, name: true } },
        },
      },
    },
  });

  for (const a of applications) {
    if (!a.jobPost?.venue || a.waiter.role !== "WAITER") continue;
    add({
      venueId:        a.jobPost.venue.id,
      venueName:      a.jobPost.venue.name,
      waiterId:       a.waiter.id,
      waiterName:     a.waiter.name ?? "(bez imena)",
      position:       positionFromTitle(a.jobPost.title),
      employmentType: a.jobPost.engagementType,
      startedAt:      a.jobPost.startDate ?? a.appliedAt,
      source:         "application",
    });
  }

  // ── 2. Verified engagement records (better dates than applications) ────────
  const engagements = await db.engagementRecord.findMany({
    where: { verified: true, endDate: null },
    select: {
      startDate: true, engagementType: true,
      waiter: { select: { id: true, name: true, role: true } },
      venue:  { select: { id: true, name: true } },
    },
  });

  for (const e of engagements) {
    if (e.waiter.role !== "WAITER") continue;
    add({
      venueId:        e.venue.id,
      venueName:      e.venue.name,
      waiterId:       e.waiter.id,
      waiterName:     e.waiter.name ?? "(bez imena)",
      position:       "WAITER",
      employmentType: e.engagementType,
      startedAt:      e.startDate,
      source:         "engagement",
    });
  }

  // ── 3. Head waiters — management rights already granted, roster must agree ──
  const headed = await db.venue.findMany({
    where: { headWaiterId: { not: null } },
    select: {
      id: true, name: true, createdAt: true,
      headWaiter: { select: { id: true, name: true, role: true } },
    },
  });

  for (const v of headed) {
    if (!v.headWaiter || v.headWaiter.role !== "WAITER") continue;
    add({
      venueId:        v.id,
      venueName:      v.name,
      waiterId:       v.headWaiter.id,
      waiterName:     v.headWaiter.name ?? "(bez imena)",
      position:       "HEAD_WAITER",
      employmentType: "FULL_TIME",
      startedAt:      v.createdAt,
      source:         "headWaiter",
    });
  }

  return found;
}

async function main() {
  const candidates = await collect();

  const existing = await db.venueStaff.findMany({ select: { venueId: true, waiterId: true } });
  const already = new Set(existing.map(key));

  const toCreate = [...candidates.values()].filter(c => !already.has(key(c)));

  console.log(`Candidates found:   ${candidates.size}`);
  console.log(`Already on roster:  ${candidates.size - toCreate.length}`);
  console.log(`To create:          ${toCreate.length}\n`);

  const byVenue = new Map<string, Candidate[]>();
  for (const c of toCreate) {
    const list = byVenue.get(c.venueName) ?? [];
    list.push(c);
    byVenue.set(c.venueName, list);
  }

  for (const [venueName, list] of byVenue) {
    console.log(`  ${venueName}`);
    for (const c of list) {
      const date = c.startedAt.toISOString().slice(0, 10);
      console.log(`    ${c.waiterName.padEnd(24)} ${c.position.padEnd(14)} od ${date}  [${c.source}]`);
    }
  }

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to persist.");
    return;
  }

  const result = await db.venueStaff.createMany({
    data: toCreate.map(c => ({
      venueId:        c.venueId,
      waiterId:       c.waiterId,
      position:       c.position,
      department:     departmentOf(c.position),
      employmentType: c.employmentType,
      startedAt:      c.startedAt,
      status:         "ACTIVE" as const,
    })),
    skipDuplicates: true,
  });

  console.log(`\nCreated ${result.count} roster row(s).`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
