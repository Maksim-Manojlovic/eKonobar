/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { hash }         from "bcryptjs";
import { dbRaw }        from "@/lib/db";

export async function POST(req: Request) {
  const { token, password } = await req.json();

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token je obavezan." }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Lozinka mora imati najmanje 8 karaktera." },
      { status: 400 },
    );
  }

  const record = await (dbRaw as any).passwordResetToken.findUnique({
    where: { token },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!record) {
    return NextResponse.json({ error: "Link je nevažeći." }, { status: 400 });
  }
  if (record.usedAt) {
    return NextResponse.json({ error: "Link je već iskorišćen." }, { status: 400 });
  }
  if (record.expiresAt < new Date()) {
    return NextResponse.json({ error: "Link je istekao. Zatraži novi." }, { status: 400 });
  }

  const hashedPassword = await hash(password, 12);

  await (dbRaw as any).$transaction([
    (dbRaw as any).user.update({
      where: { id: record.userId },
      data:  { hashedPassword },
    }),
    (dbRaw as any).passwordResetToken.update({
      where: { id: record.id },
      data:  { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
