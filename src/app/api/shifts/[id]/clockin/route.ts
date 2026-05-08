import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { isInsideVenueRadius, parseGuestCoordinates } from "@/lib/geofence";

const WINDOW_BEFORE_MS  = 15 * 60 * 1000;  // 15 min early
const WINDOW_AFTER_MS   = 60 * 60 * 1000;  // 60 min late
const STRICT_RADIUS_KM  = 0.05;            // 50m  — GPS approved
const GRACE_RADIUS_KM   = 0.15;            // 150m — GPS_GRACE, silent auto-approve

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "WAITER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { latitude, longitude, method } = body;

  const shift = await db.shift.findUnique({
    where: { id },
    include: {
      venue: { select: { latitude: true, longitude: true, reviewRadiusKm: true, ownerId: true, name: true } },
      assignments: { where: { waiterId: session.user.id } },
    },
  });
  if (!shift) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const assignment = shift.assignments[0];
  if (!assignment) return NextResponse.json({ error: "Niste na ovoj smeni" }, { status: 403 });
  if (assignment.clockInAt) return NextResponse.json({ error: "Već ste čekirani" }, { status: 409 });
  if (assignment.pendingClockIn) return NextResponse.json({ error: "Zahtev već čeka odobrenje" }, { status: 409 });

  const now = new Date();

  if (shift.scheduledStart) {
    const windowOpen  = new Date(shift.scheduledStart.getTime() - WINDOW_BEFORE_MS);
    const windowClose = new Date(shift.scheduledStart.getTime() + WINDOW_AFTER_MS);
    if (now < windowOpen) {
      const minsUntil = Math.round((windowOpen.getTime() - now.getTime()) / 60000);
      return NextResponse.json({ error: `Čekiranje dostupno za ${minsUntil} min` }, { status: 409 });
    }
    if (now > windowClose) {
      return NextResponse.json({ error: "Prozor za čekiranje je istekao" }, { status: 409 });
    }
  }

  const inputMethod = method === "QR" ? "QR" : "GPS"; // only GPS or QR from frontend
  const waiterName = session.user.name ?? "Konobar";

  if (inputMethod === "GPS") {
    const coords = parseGuestCoordinates(latitude, longitude);

    if (coords) {
      const strict = isInsideVenueRadius(
        { lat: coords.lat, lon: coords.lon },
        { latitude: shift.venue.latitude, longitude: shift.venue.longitude, reviewRadiusKm: STRICT_RADIUS_KM },
      );

      if (strict.allowed) {
        // Within 50m — normal GPS clock-in
        return clockIn(assignment.id, "GPS", coords.lat, coords.lon, shift, now);
      }

      const grace = isInsideVenueRadius(
        { lat: coords.lat, lon: coords.lon },
        { latitude: shift.venue.latitude, longitude: shift.venue.longitude, reviewRadiusKm: GRACE_RADIUS_KM },
      );

      if (grace.allowed) {
        // 50–150m — GPS_GRACE, silent auto-approve
        return clockIn(assignment.id, "GPS_GRACE", coords.lat, coords.lon, shift, now);
      }
    }

    // No coords or >150m — request manager approval
    await db.shiftAssignment.update({
      where: { id: assignment.id },
      data: {
        pendingClockIn: true,
        clockInLat: coords ? coords.lat : null,
        clockInLng: coords ? coords.lon : null,
      },
    });

    notify(
      shift.venue.ownerId,
      "CLOCKIN_APPROVAL_REQUESTED",
      "Zahtev za prijavu",
      `${waiterName} traži odobrenje za smenu "${shift.title}"`,
      "/dashboard/venue",
    ).catch(console.error);

    return NextResponse.json({ pending: true }, { status: 202 });
  }

  if (inputMethod === "QR") {
    return clockIn(assignment.id, "QR", null, null, shift, now);
  }

  return NextResponse.json({ error: "Nepoznata metoda" }, { status: 400 });
}

async function clockIn(
  assignmentId: string,
  method: "GPS" | "GPS_GRACE" | "QR" | "MANUAL",
  lat: number | null,
  lon: number | null,
  shift: { scheduledStart: Date | null },
  now: Date,
) {
  const lateMinutes = shift.scheduledStart
    ? Math.max(0, Math.round((now.getTime() - shift.scheduledStart.getTime()) / 60000))
    : null;

  const updated = await db.shiftAssignment.update({
    where: { id: assignmentId },
    data: {
      clockInAt: now,
      clockInMethod: method,
      clockInLat: lat,
      clockInLng: lon,
      lateMinutes,
      pendingClockIn: false,
    },
  });

  return NextResponse.json(updated);
}
