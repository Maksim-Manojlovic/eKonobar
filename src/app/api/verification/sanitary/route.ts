import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { dbRaw } from "@/lib/db";

// GET — waiter: own status; admin: all pending submissions
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role === "ADMIN") {
    const pending = await dbRaw.sanitaryBook.findMany({
      where: { status: "PENDING" },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { uploadedAt: "asc" },
    });
    return NextResponse.json(pending);
  }

  if (session.user.role !== "WAITER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const book = await db.sanitaryBook.findUnique({
    where: { userId: session.user.id },
  });
  return NextResponse.json(book ?? null);
}

// POST — waiter submits (or re-submits) their sanitary book URL
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "WAITER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { fileUrl, expiryDate } = await req.json();

  if (!fileUrl || typeof fileUrl !== "string") {
    return NextResponse.json({ error: "fileUrl required" }, { status: 400 });
  }

  const book = await db.sanitaryBook.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      fileUrl,
      status: "PENDING",
      expiryDate: expiryDate ? new Date(expiryDate) : null,
    },
    update: {
      fileUrl,
      status: "PENDING",
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      reviewedBy: null,
      reviewedAt: null,
      rejectReason: null,
    },
  });

  return NextResponse.json(book, { status: 201 });
}
