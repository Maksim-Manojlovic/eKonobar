/**
 * POST /api/mobile/auth/oauth — native Google / Facebook sign-in.
 *
 * The app runs the provider's native flow, gets a token back, and posts it here.
 * The server verifies that token with the provider itself (lib/auth/oauth-verify)
 * before believing anything in it, then issues the same bearer pair the
 * credentials login issues. From that point the two transports are identical.
 *
 * **Account linking is deliberately not implemented**, exactly as on the web. If
 * a user already exists with this email but signed up a different way, this
 * returns 409 and tells them which method to use. Linking on a matching email
 * would mean anyone able to create a Google account bearing a victim's address
 * could sign in as them — an account takeover with no password involved. Linking
 * is a feature that needs a confirmation step, not a default.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { parseBody } from "@/lib/auth/parse-body";
import { dbRaw } from "@/lib/core/db";
import { rateLimit } from "@/lib/core/rate-limit";
import { getClientIp } from "@/lib/core/ip";
import { ACCESS_TTL_SECONDS, issueAccessToken, issueRefreshToken } from "@/lib/auth/mobile-tokens";
import { OAuthVerificationError, verifyOAuthToken, type OAuthIdentity } from "@/lib/auth/oauth-verify";
import type { VerifiedUser } from "@/lib/auth/helpers";
import logger from "@/lib/core/logger";

const Schema = z.object({
  provider:   z.enum(["google", "facebook"]),
  /** Google: the ID token. Facebook: the access token. */
  token:      z.string().min(1).max(8192),
  deviceId:   z.string().min(1).max(128),
  deviceName: z.string().max(128).optional(),
  platform:   z.enum(["ios", "android"]),
});

const RATE_MAX    = 20;
const RATE_WINDOW = 15 * 60 * 1000;

export async function POST(req: NextRequest): Promise<Response> {
  const parsed = await parseBody(Schema, req);
  if (!parsed.ok) return parsed.response;
  const { provider, token, deviceId, deviceName, platform } = parsed.data;

  // Verification costs a network call to the provider, so it is worth a limit of
  // its own even though no password is being guessed here.
  if (!(await rateLimit(`oauth:ip:${getClientIp(req)}`, RATE_MAX, RATE_WINDOW))) {
    return NextResponse.json(
      { error: "Previše pokušaja prijave. Sačekaj 15 minuta." },
      { status: 429 },
    );
  }

  let identity: OAuthIdentity;
  try {
    identity = await verifyOAuthToken(provider, token);
  } catch (err) {
    if (err instanceof OAuthVerificationError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const resolved = await resolveUser(identity);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { user } = resolved;

  const [accessToken, refresh] = await Promise.all([
    issueAccessToken(user),
    issueRefreshToken(user.id, { deviceId, deviceName, platform }),
  ]);

  logger.info({ userId: user.id, provider, platform, deviceId }, "mobile oauth login");

  return NextResponse.json({
    accessToken,
    refreshToken:     refresh.token,
    expiresIn:        ACCESS_TTL_SECONDS,
    refreshExpiresAt: refresh.expiresAt.toISOString(),
    user: {
      id:               user.id,
      email:            user.email,
      name:             user.name,
      role:             user.role,
      verificationTier: user.verificationTier,
      tourCompleted:    user.tourCompleted,
    },
  });
}

/**
 * VerifiedUser is what issueAccessToken takes, and its email is non-null — a
 * session needs an address to be worth anything. `deletedAt` rides along so the
 * soft-delete check happens here rather than in a second query.
 */
type ResolvedUser = VerifiedUser & { deletedAt: Date | null };

const USER_SELECT = {
  id: true, email: true, name: true, role: true,
  verificationTier: true, tourCompleted: true, deletedAt: true,
} as const;

/** A User row's email is nullable in the schema; a sign-in's is not. */
function withEmail(
  user: Omit<ResolvedUser, "email"> & { email: string | null },
): ResolvedUser | null {
  return user.email ? { ...user, email: user.email } : null;
}

async function resolveUser(
  identity: OAuthIdentity,
): Promise<{ user: ResolvedUser } | { error: string; status: number }> {
  // dbRaw throughout: the soft-delete filter would make a deleted user look like
  // a new one, and this route would cheerfully create a second account for them.
  const existingAccount = await dbRaw.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider:          identity.provider,
        providerAccountId: identity.providerAccountId,
      },
    },
    select: { user: { select: USER_SELECT } },
  });

  if (existingAccount) {
    if (existingAccount.user.deletedAt) {
      return { error: "Nalog je deaktiviran.", status: 403 };
    }
    const user = withEmail(existingAccount.user);
    if (!user) {
      return { error: "Nalog nema email adresu. Obrati se podršci.", status: 409 };
    }
    return { user };
  }

  // No account row yet. If the email is already taken, this is a returning user
  // arriving by a different door — refuse rather than link. See the file header.
  if (identity.email) {
    const byEmail = await dbRaw.user.findUnique({
      where:  { email: identity.email },
      select: { id: true, hashedPassword: true, accounts: { select: { provider: true } } },
    });

    if (byEmail) {
      const method = byEmail.hashedPassword
        ? "lozinkom"
        : byEmail.accounts[0]?.provider === "facebook"
          ? "Facebook nalogom"
          : byEmail.accounts[0]?.provider === "google"
            ? "Google nalogom"
            : "drugim načinom";
      return {
        error:  `Nalog sa ovom email adresom već postoji. Prijavi se ${method}.`,
        status: 409,
      };
    }
  }

  if (!identity.email) {
    // Facebook can withhold the email. Without one there is no way to reach the
    // person later, and half the product (password reset, notifications) has
    // nothing to send to.
    return {
      error:  "Provajder nije podelio email adresu. Prijavi se pomoću email adrese i lozinke.",
      status: 400,
    };
  }

  try {
    // New users are WAITER. Venue-owner accounts are created by an admin only —
    // there is no identity check that proves someone owns a venue, and a Google
    // sign-in proves less than nothing about it.
    const created = await dbRaw.user.create({
      data: {
        email: identity.email,
        name:  identity.name,
        image: identity.image,
        role:  "WAITER",
        // Only stamp a verified date when the provider actually vouched for the
        // address; Facebook does not expose that flag, so it stays null there.
        emailVerified: identity.emailVerified ? new Date() : null,
        accounts: {
          create: {
            type:              "oauth",
            provider:          identity.provider,
            providerAccountId: identity.providerAccountId,
          },
        },
      },
      select: USER_SELECT,
    });
    // The row was just created from identity.email, so this cannot be null.
    const user = withEmail(created);
    if (!user) throw new Error("created oauth user has no email");
    return { user };
  } catch (err) {
    // Two devices signing in at once race on the unique email. The loser reads
    // the row the winner just wrote rather than failing.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const raced = await dbRaw.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider:          identity.provider,
            providerAccountId: identity.providerAccountId,
          },
        },
        select: { user: { select: USER_SELECT } },
      });
      if (raced && !raced.user.deletedAt) {
        const user = withEmail(raced.user);
        if (user) return { user };
      }
    }
    throw err;
  }
}
