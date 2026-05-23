import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-role";
import { db } from "@/lib/db";

export const GET = withAuth(async () => {
  const activePosts = await db.jobPost.findMany({
    where: { status: "ACTIVE" },
    select: {
      redAlert: true,
      salaryMin: true,
      salaryMax: true,
      venue: { select: { municipality: true } },
    },
  });

  const openPositions = activePosts.length;
  const redAlertCount = activePosts.filter(p => p.redAlert).length;

  const salaryPosts = activePosts.filter(p => p.salaryMin != null);
  const avgSalaryMin = salaryPosts.length > 0
    ? Math.round(salaryPosts.reduce((s, p) => s + (p.salaryMin ?? 0), 0) / salaryPosts.length)
    : null;
  const avgSalaryMax = salaryPosts.length > 0
    ? Math.round(salaryPosts.reduce((s, p) => s + (p.salaryMax ?? p.salaryMin ?? 0), 0) / salaryPosts.length)
    : null;

  const municipalityCount: Record<string, number> = {};
  for (const p of activePosts) {
    const m = p.venue.municipality;
    if (m) municipalityCount[m] = (municipalityCount[m] ?? 0) + 1;
  }
  const topMunicipalities = Object.entries(municipalityCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  return NextResponse.json({ openPositions, redAlertCount, avgSalaryMin, avgSalaryMax, topMunicipalities });
});
