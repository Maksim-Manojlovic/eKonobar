/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { randomBytes }  from "crypto";
import { dbRaw }        from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email je obavezan." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const allowed = await rateLimit(`forgot:${ip}`, 3, 15 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ ok: true }); // silent — same 200 to prevent enumeration
  }

  const normalized = email.toLowerCase().trim();

  // Always return 200 — never reveal if email exists (enumeration prevention)
  const user = await (dbRaw as any).user.findUnique({
    where: { email: normalized },
    select: { id: true, hashedPassword: true },
  });

  if (!user?.hashedPassword) {
    return NextResponse.json({ ok: true });
  }

  const token     = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await (dbRaw as any).passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  try {
    await sendPasswordResetEmail(normalized, token);
  } catch {
    // Don't expose email send failures to the client
  }

  return NextResponse.json({ ok: true });
}
