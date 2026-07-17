import { NextResponse } from "next/server";
import { withOptionalAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { parseQuery } from "@/lib/auth/parse-body";
import { BBoxSchema, venueBBoxFilter, stableJitter } from "@/lib/geo/bbox";
import { getRedAlertCutoff, redAlertVisibilityFilter } from "@/lib/passport/red-alert";
import { EngagementType } from "@prisma/client";
import { z } from "zod";

/**
 * Cap on features returned per viewport. Filters are applied in the query (never
 * client-side) so this truncates the *filtered* set — filtering after a truncated
 * fetch silently drops matches and makes the UI lie about how many exist.
 */
const MAX_FEATURES = 300;

const QuerySchema = BBoxSchema.and(
  z.object({
    redAlert:         z.enum(["true", "false"]).optional(),
    engagementType:   z.nativeEnum(EngagementType).optional(),
    sanitaryRequired: z.enum(["true", "false"]).optional(),
  }),
);

export const GET = withOptionalAuth(async (req, _ctx, session) => {
  const parsed = parseQuery(QuerySchema, req);
  if (!parsed.ok) return parsed.response;
  const { redAlert, engagementType, sanitaryRequired, ...bbox } = parsed.data;

  // Red Alert early access (PRO/PRO_PLUS). Without this the public map served the
  // full undelayed set — including redAlertNote — to anyone, paid feature or not.
  const redAlertCutoff = await getRedAlertCutoff(session);

  const jobs = await db.jobPost.findMany({
    where: {
      status: "ACTIVE",
      ...(redAlert !== undefined && { redAlert: redAlert === "true" }),
      ...(engagementType && { engagementType }),
      ...(sanitaryRequired !== undefined && { sanitaryRequired: sanitaryRequired === "true" }),
      venue: {
        isActive: true,
        ...venueBBoxFilter(bbox),
      },
      AND: redAlertVisibilityFilter(redAlertCutoff),
    },
    select: {
      id: true,
      title: true,
      engagementType: true,
      tipSystem: true,
      salaryMin: true,
      salaryMax: true,
      sanitaryRequired: true,
      redAlert: true,
      redAlertNote: true,
      startDate: true,
      venue: {
        select: {
          id: true,
          name: true,
          municipality: true,
          venueType: true,
          latitude: true,
          longitude: true,
          trustScore: true,
        },
      },
    },
    orderBy: [{ redAlert: "desc" }, { createdAt: "desc" }],
    take: MAX_FEATURES,
  });

  const features = jobs.map((j) => {
    const jitter = stableJitter(j.venue.id);
    return {
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [j.venue.longitude + jitter.lng, j.venue.latitude + jitter.lat],
      },
      properties: {
        id: j.id,
        title: j.title,
        engagementType: j.engagementType,
        tipSystem: j.tipSystem,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        sanitaryRequired: j.sanitaryRequired,
        redAlert: j.redAlert,
        redAlertNote: j.redAlertNote,
        startDate: j.startDate,
        venue: {
          id: j.venue.id,
          name: j.venue.name,
          municipality: j.venue.municipality,
          venueType: j.venue.venueType,
          trustScore: j.venue.trustScore,
        },
      },
    };
  });

  // Cache must be split by entitlement, never shared across it. The delayed set is
  // identical for every unauthenticated/FREE caller, so it stays CDN-cacheable. The
  // undelayed PRO set is per-user and must never land in a shared cache — a single
  // public hit there would hand every FREE waiter the early access they didn't buy.
  const cacheControl = redAlertCutoff
    ? "public, s-maxage=15, stale-while-revalidate=30"
    : "private, no-store";

  return NextResponse.json(
    { type: "FeatureCollection", features },
    { headers: { "Cache-Control": cacheControl } },
  );
});
