import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { dbRaw } from "@/lib/core/db";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

/**
 * Self-signup is WAITER only.
 *
 * Venue-owner accounts are created by an admin, not by whoever fills in a form:
 * an owner account can post jobs, see applicants' passports and verify staff, so
 * it is granted after the venue is known to be real. The public path for a venue
 * is the demo-lead form on /for-venues, which an admin then acts on.
 *
 * This used to accept VENUE_OWNER, which meant anyone could hand themselves an
 * owner account by choosing it on the signup form or by posting the role here
 * directly.
 */
const RegisterSchema = z.object({
  name:     z.string().min(1, "Ime je obavezno").trim(),
  email:    z.string().email("Nevažeća email adresa"),
  password: z.string().min(8, "Lozinka mora imati najmanje 8 karaktera"),
  role:     z.literal("WAITER").default("WAITER"),
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
