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

/** The public feed has always been capped here; keep it. */
const PUBLIC_DEFAULT_LIMIT = 50;

/**
 * The owner's own-posts query had no cap at all, so any number chosen now is a
 * behaviour change for the web dashboard. 200 is high enough that no real venue
 * truncates — the largest seeded owner has single digits — while still bounding
 * a query that otherwise grows forever. Mobile passes a small explicit limit.
 */
const OWNER_DEFAULT_LIMIT = 200;

const MAX_LIMIT = 200;

/**
 * `cursor` is the id of the last post already seen; `limit` caps the page.
 *
 * The response stays a bare array in every case, so the web clients are
 * unaffected. A caller knows there is more when it gets back exactly `limit`
 * rows and passes the last id as the next cursor — one extra empty request when
 * the total is an exact multiple, in exchange for not versioning the payload.
 */
function readPaging(searchParams: URLSearchParams, fallback: number): { take: number; cursor?: string } {
  const raw    = Number(searchParams.get("limit"));
  const take   = Number.isFinite(raw) && raw >= 1 ? Math.min(raw, MAX_LIMIT) : fallback;
  const cursor = searchParams.get("cursor") ?? undefined;
  return { take, cursor };
}

export const GET = withOptionalAuth(async (req, _ctx, session) => {
  const { searchParams } = new URL(req.url);
  const owner = session?.user.role === "VENUE_OWNER" ? session.user : null;
  // `skip: 1` steps past the cursor row itself, which the client already holds.
  const { take, cursor } = readPaging(
    searchParams,
    owner ? OWNER_DEFAULT_LIMIT : PUBLIC_DEFAULT_LIMIT,
  );
  const cursorArgs = cursor ? { cursor: { id: cursor }, skip: 1 } : {};

  // Venue owner sees only their own posts (all statuses)
  if (owner) {
    const posts = await db.jobPost.findMany({
      where: { ownerId: owner.id },
      include: {
        venue: { select: { id: true, name: true, address: true, municipality: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
      ...cursorArgs,
    });
    return NextResponse.json(posts);
  }

  // Everyone else (waiters, guests): active posts with optional filters
  const redAlertFilter = searchParams.get("redAlert") === "true" ? true : undefined;
  const type           = searchParams.get("type") as EngagementType | null;
  const search         = searchParams.get("search") ?? undefined;

  // Red Alert visibility: signed-in callers see Red Alert posts immediately,
  // anonymous callers only see posts ≥30 min old.
  const redAlertCutoff = getRedAlertCutoff(session);

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
    take,
    ...cursorArgs,
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
  if (!venue) return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });

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

  // Red Alert reverse discovery: ping available waiters whose declared reach
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
