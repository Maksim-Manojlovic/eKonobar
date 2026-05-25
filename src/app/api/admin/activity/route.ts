import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { dbRaw } from "@/lib/core/db";

export const GET = withRole("ADMIN", async () => {
  const [users, payments, reviews, applications] = await Promise.all([
    dbRaw.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    dbRaw.passportPayment.findMany({
      where: { status: "SUCCESS" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, userId: true, tier: true, amountRsd: true, createdAt: true,
        user: { select: { name: true, email: true } } },
    }),
    dbRaw.review.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, direction: true, status: true, createdAt: true,
        author: { select: { name: true } },
        venue: { select: { name: true } } },
    }),
    dbRaw.jobApplication.findMany({
      orderBy: { appliedAt: "desc" },
      take: 10,
      select: { id: true, appliedAt: true,
        waiter: { select: { name: true } },
        jobPost: { select: { title: true, venue: { select: { name: true } } } } },
    }),
  ]);

  type Event = { id: string; type: string; title: string; sub: string; ts: Date; link?: string };

  const events: Event[] = [
    ...users.map(u => ({
      id: `reg-${u.id}`,
      type: "registration",
      title: `Novi korisnik: ${u.name ?? u.email}`,
      sub: u.role === "WAITER" ? "Konobar" : u.role === "VENUE_OWNER" ? "Vlasnik lokala" : u.role === "HEADHUNTER" ? "Headhunter" : u.role,
      ts: u.createdAt,
      link: `/admin/users`,
    })),
    ...payments.map(p => ({
      id: `pay-${p.id}`,
      type: "payment",
      title: `Pretplata: ${p.tier} — ${Math.round(p.amountRsd / 100).toLocaleString("sr-RS")} RSD`,
      sub: p.user?.name ?? p.user?.email ?? "Konobar",
      ts: p.createdAt,
    })),
    ...reviews.map(r => ({
      id: `rev-${r.id}`,
      type: "review",
      title: `Recenzija: ${r.direction.replace(/_/g, " → ").toLowerCase()}`,
      sub: r.venue?.name ?? (r.author?.name ?? "Gost"),
      ts: r.createdAt,
      link: r.status === "DISPUTED" ? "/admin/moderation" : undefined,
    })),
    ...applications.map(a => ({
      id: `app-${a.id}`,
      type: "application",
      title: `Prijava: ${a.jobPost?.title ?? "Oglas"}`,
      sub: `${a.waiter?.name ?? "Konobar"} → ${a.jobPost?.venue?.name ?? ""}`,
      ts: a.appliedAt,
    })),
  ];

  events.sort((a, b) => b.ts.getTime() - a.ts.getTime());

  return NextResponse.json(events.slice(0, 25));
});
