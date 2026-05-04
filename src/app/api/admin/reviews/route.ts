import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbRaw } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
}
