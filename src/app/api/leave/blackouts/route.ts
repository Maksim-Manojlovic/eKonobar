import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { parseBody, parseQuery } from "@/lib/auth/parse-body";
import { z } from "zod";
import { getLeaveAccess, coversDepartment } from "@/lib/leave/auth";
import { parseDateOnly, formatDateOnly, eachDateInRange, daysBetween } from "@/lib/leave/dates";

const DepartmentEnum = z.enum(["FOH", "BOH"]);

/** A year of days at once is the natural calendar view; beyond that is abuse. */
const MAX_RANGE_DAYS = 400;

const QuerySchema = z.object({
  venueId:    z.string().min(1),
  from:       z.string().min(1),
  to:         z.string().min(1),
  department: DepartmentEnum.optional(),
});

const WriteSchema = z.object({
  venueId:    z.string().min(1),
  department: DepartmentEnum,
  from:       z.string().min(1),
  to:         z.string().min(1),
  maxOff:     z.number().int().min(0).max(999).optional(),
  reason:     z.string().max(200).nullish(),
  /** Restrict a bulk write to specific weekdays (0=Sun…6=Sat), e.g. every Friday in December. */
  weekdays:   z.array(z.number().int().min(0).max(6)).optional(),
});

/**
 * Parse and sanity-check a from/to pair.
 *
 * Discriminated on `ok`, matching the parseBody/parseQuery convention, so a
 * caller writes `if (!r.ok) return r.response;` and gets narrowing for free.
 */
type RangeResult =
  | { ok: true;  start: Date; end: Date }
  | { ok: false; response: NextResponse };

function parseRange(from: string, to: string): RangeResult {
  const start = parseDateOnly(from);
  const end   = parseDateOnly(to);
  if (!start || !end) {
    return { ok: false, response: NextResponse.json({ error: "Nevažeći datum (očekivano YYYY-MM-DD)" }, { status: 400 }) };
  }
  if (end < start) {
    return { ok: false, response: NextResponse.json({ error: "Krajnji datum je pre početnog" }, { status: 400 }) };
  }
  if (daysBetween(start, end) + 1 > MAX_RANGE_DAYS) {
    return { ok: false, response: NextResponse.json({ error: `Opseg je duži od ${MAX_RANGE_DAYS} dana` }, { status: 400 }) };
  }
  return { ok: true, start, end };
}

// ── GET — blackouts in a window ───────────────────────────────────────────────

export const GET = withAuth(async (req, _ctx, session) => {
  const parsed = parseQuery(QuerySchema, req);
  if (!parsed.ok) return parsed.response;
  const { venueId, from, to, department } = parsed.data;

  const range = parseRange(from, to);
  if (!range.ok) return range.response;

  const { venueExists, access } = await getLeaveAccess(venueId, session.user.id, session.user.role);
  if (!venueExists) return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });
  if (!access)      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Never widen beyond what this user may see: a requested department must be
  // one they have access to, and with none requested they get only their own.
  const departments = department
    ? (coversDepartment(access, department) ? [department] : [])
    : access.departments;

  if (departments.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db.venueBlackoutDate.findMany({
    where: {
      venueId,
      department: { in: departments },
      date: { gte: range.start, lte: range.end },
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({
    blackouts: rows.map(r => ({
      id:         r.id,
      department: r.department,
      date:       formatDateOnly(r.date),
      maxOff:     r.maxOff,
      reason:     r.reason,
    })),
    departments,
    hasKitchen:         access.hasKitchen,
    canManageBlackouts: access.canManageBlackouts,
  });
});

// ── POST — block a range ──────────────────────────────────────────────────────

export const POST = withAuth(async (req, _ctx, session) => {
  const parsed = await parseBody(WriteSchema, req);
  if (!parsed.ok) return parsed.response;
  const { venueId, department, from, to, maxOff = 0, reason, weekdays } = parsed.data;

  const range = parseRange(from, to);
  if (!range.ok) return range.response;

  const { venueExists, access } = await getLeaveAccess(venueId, session.user.id, session.user.role);
  if (!venueExists)                 return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });
  if (!access?.canManageBlackouts)  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!coversDepartment(access, department)) {
    return NextResponse.json({ error: "Nemate pristup tom odeljenju" }, { status: 403 });
  }

  const dates = eachDateInRange(range.start, range.end)
    .map(s => parseDateOnly(s)!)
    .filter(d => !weekdays || weekdays.includes(d.getUTCDay()));

  if (dates.length === 0) {
    return NextResponse.json({ error: "Opseg ne sadrži nijedan dan" }, { status: 400 });
  }

  // Upsert per date: re-blocking an already-blocked day should change its cap,
  // not 409. createMany(skipDuplicates) would silently ignore the new maxOff.
  await db.$transaction(
    dates.map(date =>
      db.venueBlackoutDate.upsert({
        where:  { venueId_department_date: { venueId, department, date } },
        create: { venueId, department, date, maxOff, reason: reason || null },
        update: { maxOff, reason: reason || null },
      }),
    ),
  );

  return NextResponse.json({ written: dates.length, department }, { status: 201 });
});

// ── DELETE — unblock a range ──────────────────────────────────────────────────

export const DELETE = withAuth(async (req, _ctx, session) => {
  const parsed = await parseBody(WriteSchema.omit({ maxOff: true, reason: true }), req);
  if (!parsed.ok) return parsed.response;
  const { venueId, department, from, to, weekdays } = parsed.data;

  const range = parseRange(from, to);
  if (!range.ok) return range.response;

  const { venueExists, access } = await getLeaveAccess(venueId, session.user.id, session.user.role);
  if (!venueExists)                return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });
  if (!access?.canManageBlackouts) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!coversDepartment(access, department)) {
    return NextResponse.json({ error: "Nemate pristup tom odeljenju" }, { status: 403 });
  }

  // With a weekday filter the delete must target exactly those dates, otherwise
  // "unblock every Friday" would clear the whole range.
  const dates = weekdays
    ? eachDateInRange(range.start, range.end)
        .map(s => parseDateOnly(s)!)
        .filter(d => weekdays.includes(d.getUTCDay()))
    : null;

  const { count } = await db.venueBlackoutDate.deleteMany({
    where: {
      venueId,
      department,
      ...(dates
        ? { date: { in: dates } }
        : { date: { gte: range.start, lte: range.end } }),
    },
  });

  return NextResponse.json({ deleted: count, department });
});
