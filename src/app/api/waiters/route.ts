import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { VerificationTier } from "@prisma/client";
import logger from "@/lib/logger";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "VENUE_OWNER" && session.user.role !== "HEADHUNTER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);

  const available       = searchParams.get("available");
  const minScore        = searchParams.get("minScore");
  const sanitaryBook    = searchParams.get("sanitaryBook");
  const tierParam       = searchParams.get("verificationTier") as VerificationTier | null;
  const skillsParam     = searchParams.get("skills");   // comma-separated
  const langsParam      = searchParams.get("languages"); // comma-separated
  const minExp          = searchParams.get("minExperience");
  const search          = searchParams.get("search");
  const page            = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit           = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "25", 10)));

  const skills    = skillsParam   ? skillsParam.split(",").map(s => s.trim()).filter(Boolean)   : [];
  const languages = langsParam    ? langsParam.split(",").map(l => l.trim()).filter(Boolean)     : [];

  const passportFilter: Record<string, unknown> = {};
  if (available === "true")   passportFilter.currentlyAvailable = true;
  if (minScore)               passportFilter.score = { gte: Number(minScore) };
  if (sanitaryBook === "true") passportFilter.sanitaryBookValid = true;
  if (minExp)                 passportFilter.yearsExperience = { gte: Number(minExp) };
  if (skills.length > 0)      passportFilter.skills = { hasSome: skills };
  if (languages.length > 0)   passportFilter.languages = { hasSome: languages };

  const where = {
    role: "WAITER" as const,
    deletedAt: null,
    ...(tierParam && Object.values(VerificationTier).includes(tierParam) && {
      verificationTier: tierParam,
    }),
    ...(search && {
      name: { contains: search, mode: "insensitive" as const },
    }),
    ...(Object.keys(passportFilter).length > 0 && { waiterPassport: passportFilter }),
  };

  try {
    const [total, waiters] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          image: true,
          verificationTier: true,
          waiterPassport: {
            select: {
              score: true,
              tierRank: true,
              skills: true,
              languages: true,
              yearsExperience: true,
              sanitaryBookValid: true,
              currentlyAvailable: true,
              badges: true,
              bio: true,
              reviewCount: true,
              totalEngagements: true,
              shareToken: true,
              passportTier: true,
              subscriptionExpiresAt: true,
            },
          },
        },
        orderBy: [
          { waiterPassport: { tierRank: "desc" } },
          { waiterPassport: { score: "desc" } },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      waiters,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error({ err }, "GET /api/waiters");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
