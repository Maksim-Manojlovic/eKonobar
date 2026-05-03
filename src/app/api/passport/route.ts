import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "WAITER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const passport = await db.waiterPassport.findUnique({
    where: { userId: session.user.id },
    include: { trustScore: true },
  });

  return NextResponse.json(passport ?? null);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "WAITER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { bio, skills, languages, yearsExperience, currentlyAvailable } = body;

  try {
    const passport = await db.waiterPassport.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        bio: bio ?? null,
        skills: Array.isArray(skills) ? skills : [],
        languages: Array.isArray(languages) ? languages : [],
        yearsExperience: yearsExperience != null ? Number(yearsExperience) : 0,
        currentlyAvailable: currentlyAvailable ?? true,
      },
      update: {
        ...(bio !== undefined && { bio: bio || null }),
        ...(skills !== undefined && { skills: Array.isArray(skills) ? skills : [] }),
        ...(languages !== undefined && { languages: Array.isArray(languages) ? languages : [] }),
        ...(yearsExperience !== undefined && { yearsExperience: Number(yearsExperience) }),
        ...(currentlyAvailable !== undefined && { currentlyAvailable }),
      },
      include: { trustScore: true },
    });
    return NextResponse.json(passport);
  } catch (err) {
    console.error("[PUT /api/passport]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
