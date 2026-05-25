import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { dbRaw } from "@/lib/core/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, password, role } = body as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
  };

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "Sva polja su obavezna." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Lozinka mora imati najmanje 8 karaktera." },
      { status: 400 },
    );
  }

  if (!["WAITER", "VENUE_OWNER"].includes(role ?? "")) {
    return NextResponse.json({ error: "Nevažeća uloga." }, { status: 400 });
  }

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
      name: name.trim(),
      email: email.toLowerCase(),
      hashedPassword,
      role: role as "WAITER" | "VENUE_OWNER",
    },
  });

  return NextResponse.json({ ok: true });
}
