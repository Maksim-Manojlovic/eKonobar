import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { VerificationTier } from "@prisma/client";

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

  const skills    = skillsParam   ? skillsParam.split(",").map(s => s.trim()).filter(Boolean)   : [];
  const languages = langsParam    ? langsParam.split(",").map(l => l.trim()).filter(Boolean)     : [];

  const passportFilter: Record<string, unknown> = {};
  if (available === "true")   passportFilter.currentlyAvailable = true;
  if (minScore)               passportFilter.score = { gte: Number(minScore) };
  if (sanitaryBook === "true") passportFilter.sanitaryBookValid = true;
  if (minExp)                 passportFilter.yearsExperience = { gte: Number(minExp) };
  if (skills.length > 0)      passportFilter.skills = { hasSome: skills };
  if (languages.length > 0)   passportFilter.languages = { hasSome: languages };

  try {
    const waiters = await db.user.findMany({
      where: {
        role: "WAITER",
        deletedAt: null,
        ...(tierParam && Object.values(VerificationTier).includes(tierParam) && {
          verificationTier: tierParam,
        }),
        ...(search && {
          name: { contains: search, mode: "insensitive" },
        }),
        ...(Object.keys(passportFilter).length > 0 && { waiterPassport: passportFilter }),
      },
      select: {
        id: true,
        name: true,
        image: true,
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
            reviewCount: true,
            totalEngagements: true,
            shareToken: true,
            passportTier: true,
            subscriptionExpiresAt: true,
          },
        },
      },
      orderBy: [
        { waiterPassport: { score: "desc" } },
      ],
      take: 100,
    });

    const now = new Date();

    // Tier rank: PRO_PLUS = 2, PRO = 1, FREE = 0. Expired subs count as FREE.
    const tierRank = (w: typeof waiters[0]) => {
      const p = w.waiterPassport;
      if (!p) return 0;
      if (p.subscriptionExpiresAt && p.subscriptionExpiresAt < now) return 0;
      if (p.passportTier === "PRO_PLUS") return 2;
      if (p.passportTier === "PRO") return 1;
      return 0;
    };

    // Sort: tier desc first, score desc within same tier
    const sorted = waiters.sort((a, b) => {
      const tierDiff = tierRank(b) - tierRank(a);
      if (tierDiff !== 0) return tierDiff;
      return (b.waiterPassport?.score ?? 0) - (a.waiterPassport?.score ?? 0);
    });

    return NextResponse.json(sorted);
  } catch (err) {
    console.error("[GET /api/waiters]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
