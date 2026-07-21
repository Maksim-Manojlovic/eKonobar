import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { dbRaw } from "@/lib/core/db";

export const GET = withRole("ADMIN", async (req) => {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const role   = searchParams.get("role") ?? "";
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit  = 25;

  const where = {
    deletedAt: null,
    ...(role ? { role: role as never } : {}),
    ...(search ? {
      OR: [
        { name:  { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [users, total] = await Promise.all([
    dbRaw.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, name: true, email: true, role: true,
        verificationTier: true, createdAt: true, deletedAt: true,
        waiterPassport: {
          select: { score: true },
        },
      },
    }),
    dbRaw.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, pages: Math.ceil(total / limit) });
});
