import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isInsideVenueRadius, parseGuestCoordinates } from "@/lib/geofence";

const WINDOW_BEFORE_MS = 15 * 60 * 1000; // 15 min early
const WINDOW_AFTER_MS  = 60 * 60 * 1000; // 60 min late

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "WAITER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { latitude, longitude, method } = body; // method: "GPS" | "QR" | "MANUAL"

  const shift = await db.shift.findUnique({
    where: { id },
    include: {
      venue: { select: { latitude: true, longitude: true, reviewRadiusKm: true } },
      assignments: { where: { waiterId: session.user.id } },
    },
  });
  if (!shift) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const assignment = shift.assignments[0];
  if (!assignment) return NextResponse.json({ error: "Niste na ovoj smeni" }, { status: 403 });
  if (assignment.clockInAt) return NextResponse.json({ error: "Već ste čekirani" }, { status: 409 });

  const now = new Date();

  // Time window check (only if scheduledStart is set)
  if (shift.scheduledStart) {
    const windowOpen  = new Date(shift.scheduledStart.getTime() - WINDOW_BEFORE_MS);
    const windowClose = new Date(shift.scheduledStart.getTime() + WINDOW_AFTER_MS);
    if (now < windowOpen) {
      const minsUntil = Math.round((windowOpen.getTime() - now.getTime()) / 60000);
      return NextResponse.json(
        { error: `Čekiranje dostupno za ${minsUntil} min` },
        { status: 409 },
      );
    }
    if (now > windowClose) {
      return NextResponse.json({ error: "Prozor za čekiranje je istekao" }, { status: 409 });
    }
  }

  const clockInMethod = method === "QR" ? "QR" : method === "MANUAL" ? "MANUAL" : "GPS";

  // Geofence check for GPS clock-in
  if (clockInMethod === "GPS") {
    const coords = parseGuestCoordinates(latitude, longitude);
    if (!coords) {
      return NextResponse.json({ error: "Koordinate su obavezne za GPS čekiranje" }, { status: 400 });
    }
    const geofence = isInsideVenueRadius(
      { lat: coords.lat, lon: coords.lon },
      { latitude: shift.venue.latitude, longitude: shift.venue.longitude, reviewRadiusKm: 0.05 }, // 50m for clock-in
    );
    if (!geofence.allowed) {
      return NextResponse.json(
        { error: `Morate biti u lokalu (${Math.round(geofence.distanceKm * 1000)}m od lokala)` },
        { status: 403 },
      );
    }
  }

  const lateMinutes = shift.scheduledStart
    ? Math.max(0, Math.round((now.getTime() - shift.scheduledStart.getTime()) / 60000))
    : null;

  const updated = await db.shiftAssignment.update({
    where: { id: assignment.id },
    data: {
      clockInAt: now,
      clockInMethod,
      clockInLat: clockInMethod === "GPS" ? Number(latitude) : null,
      clockInLng: clockInMethod === "GPS" ? Number(longitude) : null,
      lateMinutes,
    },
  });

  return NextResponse.json(updated);
}
