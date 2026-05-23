import { NextResponse } from "next/server";
import { withAuth, withRole } from "@/lib/with-role";
import { db } from "@/lib/db";
import { dbRaw } from "@/lib/db";

// GET — waiter: own status; admin: all pending submissions
export const GET = withAuth(async (_req, _ctx, session) => {
  if (session.user.role === "ADMIN") {
    const pending = await dbRaw.sanitaryBook.findMany({
      where: { status: "PENDING" },
      select: {
        id: true, status: true, expiryDate: true, uploadedAt: true,
        rejectReason: true, reviewedBy: true, reviewedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { uploadedAt: "asc" },
    });
    // fileUrl is omitted — admins access documents via the auth-gated /file endpoint
    return NextResponse.json(pending);
  }

  if (session.user.role !== "WAITER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const book = await db.sanitaryBook.findUnique({
    where: { userId: session.user.id },
  });
  return NextResponse.json(book ?? null);
});

// POST — waiter submits (or re-submits) their sanitary book URL
export const POST = withRole("WAITER", async (req, _ctx, session) => {
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
});
