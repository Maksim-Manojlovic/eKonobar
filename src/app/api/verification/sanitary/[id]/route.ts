import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbRaw } from "@/lib/db";
import { logAudit } from "@/lib/audit";

// PATCH — admin approves or rejects a submission
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { action, rejectReason } = await req.json(); // action: "approve" | "reject"

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }

  const book = await dbRaw.sanitaryBook.findUnique({ where: { id } });
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await dbRaw.$transaction(async (tx) => {
    const newStatus = action === "approve" ? "APPROVED" : "REJECTED";

    const b = await tx.sanitaryBook.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        rejectReason: action === "reject" ? (rejectReason ?? null) : null,
      },
    });

    // Sync sanitaryBookValid flag on WaiterPassport
    if (action === "approve") {
      await tx.waiterPassport.upsert({
        where: { userId: book.userId },
        create: {
          userId: book.userId,
          sanitaryBookValid: true,
          sanitaryExpiry: b.expiryDate ?? null,
        },
        update: {
          sanitaryBookValid: true,
          sanitaryExpiry: b.expiryDate ?? null,
        },
      });
    } else {
      await tx.waiterPassport.updateMany({
        where: { userId: book.userId },
        data: { sanitaryBookValid: false, sanitaryExpiry: null },
      });
    }

    return b;
  });

  logAudit(
    session.user.id,
    action === "approve" ? "SANITARY_APPROVED" : "SANITARY_REJECTED",
    id,
    "SanitaryBook",
    rejectReason ? { rejectReason } : undefined,
  );

  return NextResponse.json(updated);
}
