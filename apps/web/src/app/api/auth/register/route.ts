import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { dbRaw } from "@/lib/core/db";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const RegisterSchema = z.object({
  name:     z.string().min(1, "Ime je obavezno").trim(),
  email:    z.string().email("Nevažeća email adresa"),
  password: z.string().min(8, "Lozinka mora imati najmanje 8 karaktera"),
  role:     z.enum(["WAITER", "VENUE_OWNER"]),
});

export async function POST(req: NextRequest) {
  const parsed = await parseBody(RegisterSchema, req);
  if (!parsed.ok) return parsed.response;
  const { name, email, password, role } = parsed.data;

  const existing = await dbRaw.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Email adresa je već registrovana." },
      { status: 409 },
    );
  }

  const hashedPassword = await hash(password, 12);

  await dbRaw.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      hashedPassword,
      role,
    },
  });

  return NextResponse.json({ ok: true });
}
