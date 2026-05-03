import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENUE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const available = searchParams.get("available");
  const minScore  = searchParams.get("minScore");

  const passportFilter: Record<string, unknown> = {};
  if (available === "true") passportFilter.currentlyAvailable = true;
  if (minScore)             passportFilter.score = { gte: Number(minScore) };

  try {
    const waiters = await db.user.findMany({
      where: {
        role: "WAITER",
        deletedAt: null,
        ...(Object.keys(passportFilter).length > 0 && { waiterPassport: passportFilter }),
      },
      select: {
        id: true,
        name: true,
        verificationTier: true,
        waiterPassport: {
          select: {
            score: true,
            skills: true,
            languages: true,
            yearsExperience: true,
            sanitaryBookValid: true,
            currentlyAvailable: true,
            badges: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(waiters);
  } catch (err) {
    console.error("[GET /api/waiters]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
