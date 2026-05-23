import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    ...(type   && { venueType: type }),
    ...(active === "true"  && { isActive: true }),
    ...(active === "false" && { isActive: false }),
  };

  const [venues, total] = await Promise.all([
    db.venue.findMany({
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
    db.venue.count({ where }),
  ]);

  return NextResponse.json({
    venues,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
