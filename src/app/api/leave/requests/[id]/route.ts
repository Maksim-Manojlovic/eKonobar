import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";
import { fireSideEffects } from "@/lib/notifications/side-effects";
import logger from "@/lib/core/logger";
import { getLeaveAccess } from "@/lib/leave/auth";
import { resolvePolicy, hasCapacity } from "@/lib/leave/policy";
import { formatDateOnly, eachDateInRange } from "@/lib/leave/dates";
import {
  commitPending, releasePending, refundUsed, recordSickDays, countOffPerDate,
} from "@/lib/leave/balance";
import { deductsFromBalance, bypassesCapacity } from "@/lib/leave/request";
import { findShiftConflicts } from "@/lib/leave/conflicts";
import { LEAVE_TYPE_LABELS } from "@/lib/formatting/display-maps";

type Ctx = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  action:       z.enum(["approve", "reject", "cancel"]),
  rejectReason: z.string().max(500).nullish(),
});

export const PATCH = withAuth<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params;
  const parsed = await parseBody(PatchSchema, req);
  if (!parsed.ok) return parsed.response;
  const { action, rejectReason } = parsed.data;

  const request = await db.leaveRequest.findUnique({
    where: { id },
    select: {
      id: true, venueId: true, waiterId: true, staffId: true, department: true,
      type: true, status: true, year: true, days: true,
      startDate: true, endDate: true,
    },
  });
  if (!request) return NextResponse.json({ error: "Zahtev nije pronađen" }, { status: 404 });

  const { access } = await getLeaveAccess(request.venueId, session.user.id, session.user.role);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isOwnRequest = request.waiterId === session.user.id;
  const isManager =
    access.canManageBlackouts && access.departments.includes(request.department);

  // ── cancel — the requester withdraws ────────────────────────────────────────
  if (action === "cancel") {
    // A manager may also cancel on the worker's behalf (plans change, the venue
    // is told verbally), but nobody else can.
    if (!isOwnRequest && !isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (request.status !== "PENDING" && request.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Može se otkazati samo zahtev na čekanju ili odobren zahtev" },
        { status: 400 },
      );
    }

    const updated = await db.$transaction(async (tx) => {
      const balance = await tx.leaveBalance.findUnique({
        where: { staffId_year: { staffId: request.staffId, year: request.year } },
        select: { id: true },
      });

      if (balance) {
        if (request.type === "SICK") {
          // Only an approved sick request was ever counted.
          if (request.status === "APPROVED") {
            await recordSickDays(tx, balance.id, -request.days);
          }
        } else if (deductsFromBalance(request.type)) {
          await (request.status === "PENDING"
            ? releasePending(tx, balance.id, request.days)
            : refundUsed(tx, balance.id, request.days));
        }
      }

      return tx.leaveRequest.update({
        where: { id },
        data: { status: "CANCELLED", reviewedById: session.user.id, reviewedAt: new Date() },
      });
    });

    notifyResolution(request, "CANCELLED", session.user.id, null);
    return NextResponse.json(serialize(updated));
  }

  // ── approve / reject — a manager decides ───────────────────────────────────
  if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // A manager must not rubber-stamp their own leave; that goes to the owner.
  if (isOwnRequest) {
    return NextResponse.json(
      { error: "Ne možete odlučivati o sopstvenom zahtevu — to radi vlasnik" },
      { status: 403 },
    );
  }

  if (request.status !== "PENDING") {
    return NextResponse.json(
      { error: "O ovom zahtevu je već odlučeno" },
      { status: 409 },
    );
  }

  if (action === "reject") {
    const updated = await db.$transaction(async (tx) => {
      const balance = await tx.leaveBalance.findUnique({
        where: { staffId_year: { staffId: request.staffId, year: request.year } },
        select: { id: true },
      });
      // Reserved days go back — a rejection must not quietly cost the worker.
      if (balance && deductsFromBalance(request.type)) {
        await releasePending(tx, balance.id, request.days);
      }

      return tx.leaveRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectReason: rejectReason || null,
          reviewedById: session.user.id,
          reviewedAt: new Date(),
        },
      });
    });

    notifyResolution(request, "REJECTED", session.user.id, rejectReason ?? null);
    return NextResponse.json(serialize(updated));
  }

  // approve
  const policyRow = await db.leavePolicy.findUnique({
    where: { venueId_department: { venueId: request.venueId, department: request.department } },
  });
  const policy = resolvePolicy(policyRow);

  try {
    const updated = await db.$transaction(
      async (tx) => {
        // Re-check capacity at approval time: the queue may have been sitting
        // while other requests were granted, and the manager's screen is stale.
        if (!bypassesCapacity(request.type)) {
          const blackoutRows = await tx.venueBlackoutDate.findMany({
            where: {
              venueId: request.venueId,
              department: request.department,
              date: { gte: request.startDate, lte: request.endDate },
            },
            select: { date: true, maxOff: true },
          });
          const blackouts = new Map(blackoutRows.map(b => [formatDateOnly(b.date), b.maxOff]));

          const offCounts = await countOffPerDate(
            tx, request.venueId, request.department,
            request.startDate, request.endDate, request.id,
          );

          const full = eachDateInRange(request.startDate, request.endDate).find((date) => {
            const maxOff = blackouts.get(date);
            return !hasCapacity(
              policy,
              maxOff === undefined ? null : { maxOff },
              offCounts.get(date) ?? 0,
            );
          });
          if (full) throw new CapacityGone(full);
        }

        const balance = await tx.leaveBalance.findUnique({
          where: { staffId_year: { staffId: request.staffId, year: request.year } },
          select: { id: true },
        });

        if (balance) {
          if (request.type === "SICK") {
            await recordSickDays(tx, balance.id, request.days);
          } else if (deductsFromBalance(request.type)) {
            await commitPending(tx, balance.id, request.days);
          }
        }

        return tx.leaveRequest.update({
          where: { id },
          data: {
            status: "APPROVED",
            reviewedById: session.user.id,
            reviewedAt: new Date(),
            autoApproved: false,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    notifyResolution(request, "APPROVED", session.user.id, null);

    // Shifts this person is already on during the approved dates. Nothing is
    // unassigned automatically — silently pulling someone off a rota is how a
    // venue ends up short-staffed without noticing. The manager decides.
    const shiftConflicts = await findShiftConflicts(
      request.waiterId, request.startDate, request.endDate,
    );

    return NextResponse.json({
      ...serialize(updated),
      ...(shiftConflicts.length
        ? {
            shiftConflicts: shiftConflicts.map(c => ({
              assignmentId: c.id,
              shiftId:      c.shift.id,
              title:        c.shift.title,
              date:         formatDateOnly(c.shift.date),
              startTime:    c.shift.startTime,
              endTime:      c.shift.endTime,
            })),
          }
        : {}),
    });
  } catch (err) {
    if (err instanceof CapacityGone) {
      return NextResponse.json(
        { error: `${err.date} je u međuvremenu popunjen — odobrite tek kad se oslobodi mesto` },
        { status: 409 },
      );
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      return NextResponse.json(
        { error: "Istovremena izmena. Pokušajte ponovo." },
        { status: 409 },
      );
    }
    throw err;
  }
});

/** Thrown when the day filled up between request and approval. */
class CapacityGone extends Error {
  constructor(public date: string) { super(date); }
}

const serialize = <T extends { startDate: Date; endDate: Date }>(r: T) => ({
  ...r,
  startDate: formatDateOnly(r.startDate),
  endDate:   formatDateOnly(r.endDate),
});

function notifyResolution(
  request: { venueId: string; waiterId: string; department: string; type: string; startDate: Date; endDate: Date },
  outcome: "APPROVED" | "REJECTED" | "CANCELLED",
  actorId: string,
  rejectReason: string | null,
) {
  void (async () => {
    const label = LEAVE_TYPE_LABELS[request.type] ?? "Odsustvo";
    const range = `${formatDateOnly(request.startDate)} – ${formatDateOnly(request.endDate)}`;

    if (outcome === "CANCELLED") {
      // Tell the managers, unless one of them did the cancelling.
      const venue = await db.venue.findUnique({
        where: { id: request.venueId },
        select: { ownerId: true, headWaiterId: true, headChefId: true },
      });
      if (!venue) return;

      const worker = await db.user.findUnique({ where: { id: request.waiterId }, select: { name: true } });
      const recipients = new Set<string>([venue.ownerId]);
      const head = request.department === "BOH" ? venue.headChefId : venue.headWaiterId;
      if (head) recipients.add(head);
      // The worker hears about it only if somebody else cancelled for them.
      if (actorId !== request.waiterId) recipients.add(request.waiterId);
      recipients.delete(actorId);

      if (recipients.size === 0) return;
      fireSideEffects({
        notifications: [...recipients].map(userId => ({
          userId,
          type: "LEAVE_CANCELLED" as const,
          title: `Otkazano: ${label}`,
          body:  `${worker?.name ?? "Radnik"} — ${range}`,
          link:  userId === request.waiterId ? "/waiter" : "/venue",
        })),
      });
      return;
    }

    fireSideEffects({
      notifications: [{
        userId: request.waiterId,
        type: "LEAVE_RESOLVED" as const,
        title: outcome === "APPROVED" ? `${label} odobren` : `${label} odbijen`,
        body:  outcome === "APPROVED"
          ? `${range} je potvrđen.`
          : `${range}${rejectReason ? ` — ${rejectReason}` : ""}`,
        link: "/waiter",
      }],
    });
  })().catch(err => logger.error({ err, venueId: request.venueId }, "leave resolution notification failed"));
}
