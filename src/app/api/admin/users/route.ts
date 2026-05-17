import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbRaw } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
          select: { passportTier: true, score: true, subscriptionExpiresAt: true },
        },
      },
    }),
    dbRaw.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, pages: Math.ceil(total / limit) });
}
