import { NextResponse } from "next/server";
import { withRole } from "@/lib/with-role";
import { dbRaw } from "@/lib/db";

export const GET = withRole("ADMIN", async () => {
  const reviews = await dbRaw.review.findMany({
    where: { status: "DISPUTED" },
    select: {
      id: true,
      direction: true,
      status: true,
      overallRating: true,
      comment: true,
      createdAt: true,
      publishedAt: true,
      venueId: true,
      subjectId: true,
      author: { select: { id: true, name: true, email: true, verificationTier: true } },
      venue: { select: { id: true, name: true, municipality: true } },
      subject: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(reviews);
});
