import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { parseBody, parseQuery } from "@/lib/auth/parse-body";
import { z } from "zod";
import { getLeaveAccess, coversDepartment } from "@/lib/leave/auth";
import { resolvePolicy, DEFAULT_POLICY } from "@/lib/leave/policy";

const DepartmentEnum = z.enum(["FOH", "BOH"]);

const QuerySchema = z.object({
  venueId: z.string().min(1),
});

const PatchSchema = z.object({
  venueId:    z.string().min(1),
  department: DepartmentEnum,

  annualDays:        z.number().int().min(0).max(365).optional(),
  maxConcurrentOff:  z.number().int().min(0).max(999).optional(),
  minNoticeDays:     z.number().int().min(0).max(365).optional(),
  autoApprove:       z.boolean().optional(),
  countWeekends:     z.boolean().optional(),
  allowCarryOver:    z.boolean().optional(),
  carryOverDays:     z.number().int().min(0).max(365).optional(),
  // MM-DD; validated by shape so a typo cannot silently disable carry-over expiry.
  carryOverDeadline: z.string().regex(/^\d{2}-\d{2}$/, "Očekivan format MM-DD").optional(),
});

// ── GET — policy per department, defaults where nothing is stored ─────────────

export const GET = withAuth(async (req, _ctx, session) => {
  const parsed = parseQuery(QuerySchema, req);
  if (!parsed.ok) return parsed.response;

  const { venueExists, access } = await getLeaveAccess(
    parsed.data.venueId, session.user.id, session.user.role,
  );
  if (!venueExists) return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });
  if (!access)      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db.leavePolicy.findMany({ where: { venueId: access.venueId } });

  // A venue that never configured anything still gets a working policy — the
  // feature must not require setup before it does something sensible.
  const policies = access.departments.map((department) => ({
    department,
    configured: rows.some(r => r.department === department),
    ...resolvePolicy(rows.find(r => r.department === department)),
  }));

  return NextResponse.json({
    policies,
    hasKitchen:      access.hasKitchen,
    canManagePolicy: access.canManagePolicy,
    defaults:        DEFAULT_POLICY,
  });
});

// ── PATCH — upsert one department's policy ────────────────────────────────────

export const PATCH = withAuth(async (req, _ctx, session) => {
  const parsed = await parseBody(PatchSchema, req);
  if (!parsed.ok) return parsed.response;
  const { venueId, department, ...fields } = parsed.data;

  const { venueExists, access } = await getLeaveAccess(venueId, session.user.id, session.user.role);
  if (!venueExists)             return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });
  if (!access?.canManagePolicy) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Rejects a BOH policy at a venue with no kitchen — it could never be applied.
  if (!coversDepartment(access, department)) {
    return NextResponse.json(
      { error: "Ovaj lokal nema to odeljenje" },
      { status: 400 },
    );
  }

  if (fields.allowCarryOver === false && fields.carryOverDays === undefined) {
    fields.carryOverDays = 0;
  }

  const saved = await db.leavePolicy.upsert({
    where:  { venueId_department: { venueId, department } },
    create: { venueId, department, ...fields },
    update: fields,
  });

  return NextResponse.json({ department, configured: true, ...resolvePolicy(saved) });
});
