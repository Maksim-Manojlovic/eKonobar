import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const HeadWaiterSchema = z.object({
  waiterId: z.string().min(1),
});

type Ctx = { params: Promise<{ id: string }> };

// PUT — venue owner appoints a head waiter
export const PUT = withRole<Ctx>("VENUE_OWNER", async (req, ctx, session) => {
  const { id: venueId } = await ctx.params;
  const parsed = await parseBody(HeadWaiterSchema, req);
  if (!parsed.ok) return parsed.response;
  const { waiterId } = parsed.data;

  const venue = await db.venue.findFirst({ where: { id: venueId, ownerId: session.user.id } });
  if (!venue) return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });

  const waiter = await db.user.findFirst({ where: { id: waiterId, role: "WAITER" } });
  if (!waiter) return NextResponse.json({ error: "Konobar nije pronađen" }, { status: 404 });

  const updated = await db.venue.update({
    where: { id: venueId },
    data: { headWaiterId: waiterId },
    select: {
      id: true,
      headWaiterId: true,
      headWaiter: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(updated);
});

// DELETE — venue owner removes the current head waiter
export const DELETE = withRole<Ctx>("VENUE_OWNER", async (_req, ctx, session) => {
  const { id: venueId } = await ctx.params;

  const venue = await db.venue.findFirst({ where: { id: venueId, ownerId: session.user.id } });
  if (!venue) return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });

  const updated = await db.venue.update({
    where: { id: venueId },
    data: { headWaiterId: null },
    select: { id: true, headWaiterId: true },
  });

  return NextResponse.json(updated);
});
