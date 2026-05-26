import { NextResponse } from "next/server";
import { withAuth, withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { dbRaw } from "@/lib/core/db";
import type { Session } from "next-auth";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const SanitarySubmitSchema = z.object({
  fileUrl:    z.string().url(),
  expiryDate: z.string().nullish(),
});

// ── GET ───────────────────────────────────────────────────────────────────────
// ADMIN  → all PENDING submissions ordered by uploadedAt asc
// WAITER → own SanitaryBook record (or null)

export const GET = withAuth(async (_req, _ctx, session) => {
  if (session.user.role === "ADMIN")  return getAdminPending();
  if (session.user.role === "WAITER") return getWaiterStatus(session);
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
});

async function getAdminPending() {
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

async function getWaiterStatus(session: Session) {
  const book = await db.sanitaryBook.findUnique({
    where: { userId: session.user.id },
  });
  return NextResponse.json(book ?? null);
}

// ── POST ──────────────────────────────────────────────────────────────────────
// WAITER submits (or re-submits) their sanitary book URL

export const POST = withRole("WAITER", async (req, _ctx, session) => {
  const parsed = await parseBody(SanitarySubmitSchema, req);
  if (!parsed.ok) return parsed.response;
  const { fileUrl, expiryDate } = parsed.data;

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
