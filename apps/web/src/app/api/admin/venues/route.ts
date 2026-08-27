import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { dbRaw } from "@/lib/core/db";
import { VenueType } from "@prisma/client";

const PAGE_SIZE = 25;

export const GET = withRole("ADMIN", async (req) => {
  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const search   = searchParams.get("search")?.trim() ?? "";
  const type     = searchParams.get("type") ?? "";
  const active   = searchParams.get("active") ?? "";

  const where = {
    ...(search && {
      OR: [
        { name:         { contains: search, mode: "insensitive" as const } },
        { municipality: { contains: search, mode: "insensitive" as const } },
        { city:         { contains: search, mode: "insensitive" as const } },
        { owner: { name:  { contains: search, mode: "insensitive" as const } } },
        { owner: { email: { contains: search, mode: "insensitive" as const } } },
      ],
    }),
    ...(type   && { venueType: type as VenueType }),
    ...(active === "true"  && { isActive: true }),
    ...(active === "false" && { isActive: false }),
  };

  const [venues, total] = await Promise.all([
    dbRaw.venue.findMany({
      where,
      select: {
        id:           true,
        name:         true,
        venueType:    true,
        municipality: true,
        city:         true,
        isActive:     true,
        trustScore:   true,
        createdAt:    true,
        deletedAt:    true,
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { jobPosts: true, reviews: true } },
      },
      orderBy: { createdAt: "desc" },
      skip:  (page - 1) * PAGE_SIZE,
      take:  PAGE_SIZE,
    }),
    dbRaw.venue.count({ where }),
  ]);

  return NextResponse.json({
    venues,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
});
