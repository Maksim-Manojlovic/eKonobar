import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { withRole } from "@/lib/auth/with-role";
import { parseBody } from "@/lib/auth/parse-body";
import { dbRaw } from "@/lib/core/db";
import { logAudit } from "@/lib/core/audit";
import logger from "@/lib/core/logger";
import { sendPasswordResetEmail } from "@/lib/integrations/email";

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


// ── POST — create an account an admin has verified ───────────────────────────

/**
 * Roles an admin may hand out here.
 *
 * VENUE_OWNER exists on this route precisely because it does NOT exist on the
 * public signup: nothing on a form proves someone runs the venue they name, so
 * the account is created after a human has checked. HEADHUNTER is the same kind
 * of curated role. ADMIN is deliberately absent — an admin promoting someone to
 * admin should be a deliberate, separately reviewed act, and PATCH
 * /api/admin/users/[id] already exists for role changes.
 */
const CreateUserSchema = z.object({
  name:  z.string().min(1, "Ime je obavezno").trim(),
  email: z.string().email("Nevažeća email adresa"),
  role:  z.enum(["VENUE_OWNER", "HEADHUNTER", "WAITER"]),
  phone: z.string().trim().max(20).optional(),
});

/**
 * POST /api/admin/users — create an account and hand back a set-password link.
 *
 * The admin never chooses or sees a password. The account is created with a
 * random one that is generated, hashed and discarded in the same breath; its
 * only purpose is to satisfy the `hashedPassword` check in the password-reset
 * flow, which silently ignores accounts without one (that check exists to stop
 * OAuth-only accounts being reset, and an admin-created account would otherwise
 * be caught by it and left with no way to ever set a password).
 *
 * The set-password link is returned once, in this response, so the admin can
 * read it out on the call that prompted the account. It is not stored anywhere
 * readable and reopening the user later will not show it again — the token is
 * hashed into PasswordResetToken exactly as a self-service reset would be, with
 * the same one-hour, single-use lifetime.
 */
export const POST = withRole("ADMIN", async (req, _ctx, session) => {
  const parsed = await parseBody(CreateUserSchema, req);
  if (!parsed.ok) return parsed.response;

  const { name, role, phone } = parsed.data;
  const email = parsed.data.email.toLowerCase().trim();

  const existing = await dbRaw.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    // Enumeration is not a concern on an ADMIN-only route, and the admin needs
    // to know the difference between "created" and "already there".
    return NextResponse.json({ error: "Korisnik sa tom email adresom već postoji." }, { status: 409 });
  }

  // Never surfaced. Long enough that guessing it is not a strategy even though
  // the account is immediately steered to a password reset.
  const placeholderPassword = randomBytes(48).toString("base64url");

  const token     = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const user = await dbRaw.user.create({
    data: {
      name,
      email,
      role,
      phone: phone || null,
      hashedPassword: await hash(placeholderPassword, 12),
      passwordResetTokens: { create: { token, expiresAt } },
    },
    select: { id: true, name: true, email: true, role: true },
  });

  let emailSent = false;
  try {
    await sendPasswordResetEmail(email, token);
    emailSent = true;
  } catch (err) {
    // Not fatal: the link is in the response and the admin is mid-call. But a
    // broken SMTP config must not present as "the email just never arrives".
    logger.error({ err, userId: user.id }, "admin-created user: set-password email failed");
  }

  // Two admins share this surface, so who created which account has to be
  // answerable later.
  logAudit(session.user.id, "ADMIN_USER_CREATE", user.id, "User", { role, emailSent });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return NextResponse.json(
    {
      user,
      emailSent,
      /** Shown once. Read it out or paste it — it is not retrievable later. */
      setPasswordUrl: `${appUrl}/reset-password?token=${token}`,
      expiresAt: expiresAt.toISOString(),
    },
    { status: 201 },
  );
});
