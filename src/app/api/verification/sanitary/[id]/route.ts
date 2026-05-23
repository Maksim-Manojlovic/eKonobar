import { NextResponse } from "next/server";
import { withRole } from "@/lib/with-role";
import { dbRaw } from "@/lib/db";
import { logAudit } from "@/lib/audit";

// PATCH — admin approves or rejects a submission
export const PATCH = withRole<{ params: Promise<{ id: string }> }>("ADMIN", async (req, ctx, session) => {
  const { id } = await ctx.params;
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
});
