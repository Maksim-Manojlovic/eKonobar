/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { hash }         from "bcryptjs";
import { dbRaw }        from "@/lib/core/db";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const ResetSchema = z.object({
  token:    z.string().min(1),
  password: z.string().min(8, "Lozinka mora imati najmanje 8 karaktera"),
});

export async function POST(req: Request) {
  const parsed = await parseBody(ResetSchema, req);
  if (!parsed.ok) return parsed.response;
  const { token, password } = parsed.data;

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
