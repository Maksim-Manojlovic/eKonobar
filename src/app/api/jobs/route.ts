import { NextResponse } from "next/server";
import { withOptionalAuth, withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import logger from "@/lib/core/logger";
import { broadcastRedAlert } from "@/lib/notifications/red-alert-broadcast";
import { EngagementType, TipSystem } from "@prisma/client";
import { getRedAlertCutoff, redAlertVisibilityFilter } from "@/lib/passport/red-alert";
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
  // FREE tier waiters (and unauthenticated callers) only see posts ≥30 min old.
  const redAlertCutoff = await getRedAlertCutoff(session);

  // search and Red Alert visibility both need an OR. They compose under AND —
  // spreading two `{ OR }` objects into one where-object drops the first one.
  const posts = await db.jobPost.findMany({
    where: {
      status: "ACTIVE",
      ...(redAlertFilter !== undefined && { redAlert: redAlertFilter }),
      ...(type && Object.values(EngagementType).includes(type) && { engagementType: type }),
      AND: [
        ...(search
          ? [{
              OR: [
                { title:       { contains: search, mode: "insensitive" as const } },
                { description: { contains: search, mode: "insensitive" as const } },
              ],
            }]
          : []),
        ...redAlertVisibilityFilter(redAlertCutoff),
      ],
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

  // Red Alert reverse discovery: ping PRO/PRO_PLUS waiters whose declared reach
  // covers this venue's opština. Fire-and-forget — the recipient query must not
  // block the response, and a broadcast failure must not fail the post creation.
  if (post.redAlert) {
    broadcastRedAlert({
      jobPostId:    post.id,
      jobTitle:     post.title,
      venueName:    post.venue.name,
      municipality: venue.municipality,
    }).catch((err) => logger.error({ err, jobPostId: post.id }, "red-alert broadcast failed"));
  }

  return NextResponse.json(post, { status: 201 });
});
