import { NextResponse } from "next/server";
import { withOptionalAuth, withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { EngagementType, TipSystem } from "@prisma/client";
import { getEffectiveTier } from "@/lib/passport/tier";
import { RED_ALERT_DELAY_MS } from "@/lib/passport/constants";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const JobPostSchema = z.object({
  venueId:             z.string().min(1),
  title:               z.string().min(1),
  description:         z.string().min(1),
  engagementType:      z.nativeEnum(EngagementType),
  tipSystem:           z.nativeEnum(TipSystem),
  salaryMin:           z.number().min(0).nullish(),
  salaryMax:           z.number().min(0).nullish(),
  sanitaryRequired:    z.boolean().optional(),
  redAlert:            z.boolean().optional(),
  redAlertNote:        z.string().nullish(),
  startDate:           z.string().nullish(),
  endDate:             z.string().nullish(),
  applicationDeadline: z.string().nullish(),
});

export const GET = withOptionalAuth(async (req, _ctx, session) => {
  const { searchParams } = new URL(req.url);

  // Venue owner sees only their own posts (all statuses)
  if (session?.user.role === "VENUE_OWNER") {
    const posts = await db.jobPost.findMany({
      where: { ownerId: session.user.id },
      include: {
        venue: { select: { id: true, name: true, address: true, municipality: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(posts);
  }

  // Everyone else (waiters, guests): active posts with optional filters
  const redAlertFilter = searchParams.get("redAlert") === "true" ? true : undefined;
  const type           = searchParams.get("type") as EngagementType | null;
  const search         = searchParams.get("search") ?? undefined;

  // Red Alert early access: PRO/PRO_PLUS waiters see Red Alert posts immediately.
  // FREE tier waiters only see Red Alert posts older than 30 minutes.
  let redAlertCreatedAfter: Date | undefined;
  if (session?.user.role === "WAITER") {
    const passport = await db.waiterPassport.findUnique({
      where: { userId: session.user.id },
      select: { passportTier: true, subscriptionExpiresAt: true },
    });
    const now = new Date();
    const isFree = getEffectiveTier(passport) === "FREE";
    if (isFree) {
      // FREE: hide Red Alert posts created in last 30 minutes
      redAlertCreatedAfter = new Date(now.getTime() - RED_ALERT_DELAY_MS);
    }
  }

  const posts = await db.jobPost.findMany({
    where: {
      status: "ACTIVE",
      ...(redAlertFilter !== undefined && { redAlert: redAlertFilter }),
      ...(type && Object.values(EngagementType).includes(type) && { engagementType: type }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
      // For FREE waiters: Red Alert posts must be ≥30 min old
      ...(redAlertCreatedAfter && {
        OR: [
          { redAlert: false },
          { redAlert: true, createdAt: { lte: redAlertCreatedAfter } },
        ],
      }),
    },
    include: {
      venue: {
        select: { id: true, name: true, address: true, municipality: true, latitude: true, longitude: true, trustScore: true },
      },
      _count: { select: { applications: true } },
    },
    orderBy: [{ redAlert: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  return NextResponse.json(posts);
});

export const POST = withRole("VENUE_OWNER", async (req, _ctx, session) => {
  const parsed = await parseBody(JobPostSchema, req);
  if (!parsed.ok) return parsed.response;
  const {
    venueId, title, description, engagementType, tipSystem,
    salaryMin, salaryMax, sanitaryRequired, redAlert, redAlertNote,
    startDate, endDate, applicationDeadline,
  } = parsed.data;

  // Verify the venue belongs to this owner
  const venue = await db.venue.findFirst({ where: { id: venueId, ownerId: session.user.id } });
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const post = await db.jobPost.create({
    data: {
      venueId,
      ownerId: session.user.id,
      title,
      description,
      engagementType,
      tipSystem,
      salaryMin:  salaryMin  ?? undefined,
      salaryMax:  salaryMax  ?? undefined,
      sanitaryRequired: sanitaryRequired ?? false,
      redAlert: redAlert ?? false,
      redAlertNote: redAlertNote ?? undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : undefined,
    },
    include: {
      venue: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(post, { status: 201 });
});
