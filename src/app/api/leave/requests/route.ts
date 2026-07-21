import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { parseBody, parseQuery } from "@/lib/auth/parse-body";
import { z } from "zod";
import { checkRateLimit } from "@/lib/core/rate-limit";
import { fireSideEffects } from "@/lib/notifications/side-effects";
import logger from "@/lib/core/logger";
import { getLeaveAccess } from "@/lib/leave/auth";
import { resolvePolicy } from "@/lib/leave/policy";
import {
  parseDateOnly, formatDateOnly, eachDateInRange, daysBetween,
  countLeaveDays, splitByLeaveYear,
} from "@/lib/leave/dates";
import {
  ensureBalance, remainingDays, reservePending, commitDirect,
  recordSickDays, countOffPerDate,
} from "@/lib/leave/balance";
import { decideLeaveRequest, deductsFromBalance } from "@/lib/leave/request";
import { LEAVE_TYPE_LABELS } from "@/lib/formatting/display-maps";

const MAX_REQUEST_DAYS = 90;

const QuerySchema = z.object({
  venueId: z.string().min(1).optional(),
  status:  z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  year:    z.coerce.number().int().min(2000).max(2100).optional(),
});

const CreateSchema = z.object({
  venueId:       z.string().min(1),
  type:          z.enum(["ANNUAL", "SICK", "UNPAID", "PARENTAL", "SPECIAL"]).optional(),
  startDate:     z.string().min(1),
  endDate:       z.string().min(1),
  reason:        z.string().max(1000).nullish(),
  attachmentUrl: z.string().max(500).nullish(),
  /** Set only when a manager files on someone else's behalf (chiefly SICK). */
  waiterId:      z.string().min(1).optional(),
});

const REQUEST_SELECT = {
  id: true, type: true, status: true, year: true, days: true,
  startDate: true, endDate: true, department: true,
  reason: true, attachmentUrl: true, rejectReason: true,
  autoApproved: true, reviewedAt: true, createdAt: true,
  waiter: { select: { id: true, name: true, image: true } },
  staff:  { select: { position: true } },
  venue:  { select: { id: true, name: true } },
} as const;

/** YYYY-MM-DD on the wire; the DB's Date objects never reach the client. */
type RequestRow = { startDate: Date; endDate: Date };
const serialize = <T extends RequestRow>(r: T) => ({
  ...r,
  startDate: formatDateOnly(r.startDate),
  endDate:   formatDateOnly(r.endDate),
});

// ── GET ───────────────────────────────────────────────────────────────────────

export const GET = withAuth(async (req, _ctx, session) => {
  const parsed = parseQuery(QuerySchema, req);
  if (!parsed.ok) return parsed.response;
  const { venueId, status, year } = parsed.data;

  // Without a venueId a worker is asking for their own history across venues.
  if (!venueId) {
    const rows = await db.leaveRequest.findMany({
      where: {
        waiterId: session.user.id,
        ...(status && { status }),
        ...(year && { year }),
      },
      select: REQUEST_SELECT,
      orderBy: { startDate: "desc" },
      take: 200,
    });
    return NextResponse.json({ requests: rows.map(serialize), scope: "own" });
  }

  const { venueExists, access } = await getLeaveAccess(venueId, session.user.id, session.user.role);
  if (!venueExists) return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });
  if (!access)      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Rank-and-file staff see only their own requests even at a venue they belong
  // to — another worker's sick leave is not their business.
  if (!access.canManageBlackouts) {
    const rows = await db.leaveRequest.findMany({
      where: { venueId, waiterId: session.user.id, ...(status && { status }), ...(year && { year }) },
      select: REQUEST_SELECT,
      orderBy: { startDate: "desc" },
      take: 200,
    });
    return NextResponse.json({ requests: rows.map(serialize), scope: "own" });
  }

  const rows = await db.leaveRequest.findMany({
    where: {
      venueId,
      department: { in: access.departments },
      ...(status && { status }),
      ...(year && { year }),
    },
    select: REQUEST_SELECT,
    orderBy: [{ status: "asc" }, { startDate: "asc" }],
    take: 300,
  });

  return NextResponse.json({
    requests:   rows.map(serialize),
    scope:      "manage",
    departments: access.departments,
    hasKitchen: access.hasKitchen,
  });
});

// ── POST ──────────────────────────────────────────────────────────────────────

export const POST = withAuth(async (req, _ctx, session) => {
  const parsed = await parseBody(CreateSchema, req);
  if (!parsed.ok) return parsed.response;
  const { venueId, startDate, endDate, reason, attachmentUrl, waiterId } = parsed.data;
  // parseBody's generic erases Zod's .default(), so the fallback lives here.
  const type = parsed.data.type ?? "ANNUAL";

  if (!(await checkRateLimit(session.user.id, "create_leave_request", 10))) {
    return NextResponse.json({ error: "Previše zahteva. Pokušajte kasnije." }, { status: 429 });
  }

  const start = parseDateOnly(startDate);
  const end   = parseDateOnly(endDate);
  if (!start || !end) {
    return NextResponse.json({ error: "Nevažeći datum (očekivano YYYY-MM-DD)" }, { status: 400 });
  }
  if (end < start) {
    return NextResponse.json({ error: "Krajnji datum je pre početnog" }, { status: 400 });
  }
  if (daysBetween(start, end) + 1 > MAX_REQUEST_DAYS) {
    return NextResponse.json({ error: `Zahtev ne može biti duži od ${MAX_REQUEST_DAYS} dana` }, { status: 400 });
  }

  const { venueExists, access } = await getLeaveAccess(venueId, session.user.id, session.user.role);
  if (!venueExists) return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });
  if (!access)      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const filedByManager = !!waiterId && waiterId !== session.user.id;
  if (filedByManager && !access.canManageBlackouts) {
    return NextResponse.json(
      { error: "Samo rukovodilac može uneti odsustvo za drugog radnika" },
      { status: 403 },
    );
  }

  const subjectId = filedByManager ? waiterId! : session.user.id;

  const staff = await db.venueStaff.findUnique({
    where: { venueId_waiterId: { venueId, waiterId: subjectId } },
    select: { id: true, department: true, status: true, startedAt: true },
  });
  if (!staff || staff.status === "ENDED") {
    return NextResponse.json({ error: "Radnik nije na spisku osoblja ovog lokala" }, { status: 404 });
  }
  if (filedByManager && !access.departments.includes(staff.department)) {
    return NextResponse.json({ error: "Nemate pristup tom odeljenju" }, { status: 403 });
  }

  // Retroactive dates are legitimate for sickness, never for a planned holiday.
  const today = parseDateOnly(formatDateOnly(new Date()))!;
  const noticeDays = daysBetween(today, start);
  if (type !== "SICK" && noticeDays < 0) {
    return NextResponse.json({ error: "Ne možete tražiti odmor u prošlosti" }, { status: 400 });
  }

  const overlapping = await db.leaveRequest.findFirst({
    where: {
      staffId: staff.id,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: end },
      endDate:   { gte: start },
    },
    select: { id: true, startDate: true, endDate: true },
  });
  if (overlapping) {
    return NextResponse.json(
      {
        error: `Već postoji zahtev za taj period (${formatDateOnly(overlapping.startDate)} – ${formatDateOnly(overlapping.endDate)})`,
        requestId: overlapping.id,
      },
      { status: 409 },
    );
  }

  const policyRow = await db.leavePolicy.findUnique({
    where: { venueId_department: { venueId, department: staff.department } },
  });
  const policy = resolvePolicy(policyRow);

  // A manager may not self-approve. Their own request goes to the owner, so
  // auto-approval is switched off for it regardless of policy.
  const selfManaged = access.canManageBlackouts && !filedByManager;
  const effectivePolicy = selfManaged ? { ...policy, autoApprove: false } : policy;

  // A range crossing New Year becomes one request per year, so each draws from
  // the correct balance.
  const segments = splitByLeaveYear(start, end);

  const blackoutRows = await db.venueBlackoutDate.findMany({
    where: { venueId, department: staff.department, date: { gte: start, lte: end } },
    select: { date: true, maxOff: true },
  });
  const blackouts = new Map(blackoutRows.map(b => [formatDateOnly(b.date), b.maxOff]));

  try {
    const created = await db.$transaction(
      async (tx) => {
        const out = [];

        for (const segment of segments) {
          const days = countLeaveDays(segment.from, segment.to, policy.countWeekends);
          // A weekend-only request under countWeekends:false consumes nothing
          // and would otherwise create a phantom zero-day row.
          if (days === 0) continue;

          const balance = await ensureBalance(tx, staff.id, segment.year, policy, staff.startedAt);
          const offCounts = await countOffPerDate(
            tx, venueId, staff.department, segment.from, segment.to,
          );

          const decision = decideLeaveRequest({
            type,
            policy: effectivePolicy,
            days,
            dates: eachDateInRange(segment.from, segment.to),
            blackouts,
            offCounts,
            balanceRemaining: remainingDays(balance),
            noticeDays,
            filedByManager,
          });

          if (decision.outcome === "REJECTED") {
            throw new LeaveRejected(decision.message);
          }

          const approved = decision.outcome === "APPROVED";
          const row = await tx.leaveRequest.create({
            data: {
              staffId: staff.id, venueId, waiterId: subjectId,
              department: staff.department,
              type, startDate: segment.from, endDate: segment.to,
              year: segment.year, days,
              status: approved ? "APPROVED" : "PENDING",
              reason: reason || null,
              attachmentUrl: attachmentUrl || null,
              createdById: session.user.id,
              autoApproved: approved,
              ...(approved && { reviewedAt: new Date() }),
            },
            select: REQUEST_SELECT,
          });

          // Sick days are tracked separately and never touch the annual balance.
          if (type === "SICK") {
            if (approved) await recordSickDays(tx, balance.id, days);
          } else if (deductsFromBalance(type)) {
            await (approved
              ? commitDirect(tx, balance.id, days)
              : reservePending(tx, balance.id, days));
          }

          out.push({ row, pendingReason: approved ? null : decision.reason });
        }

        return out;
      },
      // Capacity is a count, which no unique constraint can express. Serializable
      // makes two concurrent requests for the last slot conflict rather than
      // both succeed.
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (created.length === 0) {
      return NextResponse.json({ error: "Zahtev ne sadrži nijedan radni dan" }, { status: 400 });
    }

    notifyOnCreate(created, venueId, staff.department, subjectId, session.user.id, type);

    return NextResponse.json(
      {
        requests: created.map(c => ({ ...serialize(c.row), pendingReason: c.pendingReason })),
        split:    created.length > 1,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof LeaveRejected) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    // Serializable conflict — another request took the slot mid-flight.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      return NextResponse.json(
        { error: "Neko je istovremeno tražio isti termin. Pokušajte ponovo." },
        { status: 409 },
      );
    }
    throw err;
  }
});

/** Thrown to unwind the transaction when a decision comes back REJECTED. */
class LeaveRejected extends Error {}

type CreatedRequest = {
  row: { id: string; status: string; startDate: Date; endDate: Date };
  pendingReason: string | null;
};

/**
 * Managers hear about anything needing a decision; the worker hears when their
 * request was settled without one.
 */
function notifyOnCreate(
  created: CreatedRequest[],
  venueId: string,
  department: string,
  subjectId: string,
  actorId: string,
  type: string,
) {
  void (async () => {
    const venue = await db.venue.findUnique({
      where: { id: venueId },
      select: { name: true, ownerId: true, headWaiterId: true, headChefId: true },
    });
    if (!venue) return;

    const label = LEAVE_TYPE_LABELS[type] ?? "Odsustvo";
    const worker = await db.user.findUnique({ where: { id: subjectId }, select: { name: true } });
    const who = worker?.name ?? "Radnik";

    const managers = new Set<string>([venue.ownerId]);
    const head = department === "BOH" ? venue.headChefId : venue.headWaiterId;
    if (head) managers.add(head);
    // Whoever filed it already knows.
    managers.delete(actorId);

    const pending  = created.filter(c => c.row.status === "PENDING");
    const approved = created.filter(c => c.row.status === "APPROVED");

    const notifications = [];

    for (const c of pending) {
      const range = `${formatDateOnly(c.row.startDate)} – ${formatDateOnly(c.row.endDate)}`;
      for (const userId of managers) {
        notifications.push({
          userId,
          type: "LEAVE_REQUESTED" as const,
          title: `${label}: ${who}`,
          body:  `Traži ${range}. Čeka vašu odluku.`,
          link:  "/venue",
        });
      }
    }

    // An auto-approved request still needs to reach the worker, since nobody
    // will click anything to tell them.
    for (const c of approved) {
      if (subjectId === actorId) {
        notifications.push({
          userId: subjectId,
          type: "LEAVE_RESOLVED" as const,
          title: `${label} odobren`,
          body:  `${formatDateOnly(c.row.startDate)} – ${formatDateOnly(c.row.endDate)} je potvrđen.`,
          link:  "/waiter",
        });
      } else {
        notifications.push({
          userId: subjectId,
          type: "LEAVE_RESOLVED" as const,
          title: `${label} evidentiran`,
          body:  `Lokal je uneo ${formatDateOnly(c.row.startDate)} – ${formatDateOnly(c.row.endDate)}.`,
          link:  "/waiter",
        });
      }
    }

    if (notifications.length) fireSideEffects({ notifications });
  })().catch(err => logger.error({ err, venueId }, "leave request notification failed"));
}
