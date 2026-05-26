import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { dbRaw } from "@/lib/core/db";
import { logAudit } from "@/lib/core/audit";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const SanitaryReviewSchema = z.object({
  action:       z.enum(["approve", "reject"]),
  rejectReason: z.string().nullish(),
});

// PATCH — admin approves or rejects a submission
export const PATCH = withRole<{ params: Promise<{ id: string }> }>("ADMIN", async (req, ctx, session) => {
  const { id } = await ctx.params;
  const parsed = await parseBody(SanitaryReviewSchema, req);
  if (!parsed.ok) return parsed.response;
  const { action, rejectReason } = parsed.data;

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
