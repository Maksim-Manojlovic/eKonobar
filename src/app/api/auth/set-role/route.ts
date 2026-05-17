import { NextResponse }    from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "@/lib/auth";
import { db }               from "@/lib/db";

const ALLOWED: string[] = ["WAITER", "VENUE_OWNER", "HEADHUNTER"];

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { role } = await req.json();
  if (!role || !ALLOWED.includes(role)) {
    return NextResponse.json({ error: "Nevažeća uloga." }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data:  { role },
  });

  return NextResponse.json({ ok: true, role });
}
