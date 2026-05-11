import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const venue = await db.venue.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      reviewRadiusKm: true,
      geofenceEnabled: true,
      images: true,
    },
  });

  if (!venue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Waiters: accepted applicants at any job for this venue
  const applications = await db.jobApplication.findMany({
    where: {
      status: "ACCEPTED",
      jobPost: { venueId: id },
    },
    select: {
      waiter: { select: { id: true, name: true, image: true } },
    },
    distinct: ["waiterId"],
  });

  const waiters = applications.map(a => a.waiter);

  return NextResponse.json({ venue, waiters });
}
