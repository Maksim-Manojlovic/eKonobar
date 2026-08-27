import { createRemoteJWKSet, jwtVerify } from "jose";
import logger from "@/lib/core/logger";

/**
 * Server-side verification of a native OAuth sign-in.
 *
 * The single rule this file exists to enforce: **the client's claim about who
 * it is means nothing.** A native app posts a token it received from Google or
 * Facebook, and the server independently confirms with the provider that the
 * token is real, was issued for *this* application, and belongs to the identity
 * it claims. Skipping either half turns "sign in with Google" into "type any
 * email you like".
 */

export type OAuthIdentity = {
  provider:          "google" | "facebook";
  providerAccountId: string;
  email:             string | null;
  name:              string | null;
  image:             string | null;
  /** Whether the provider vouches for the email address itself. */
  emailVerified:     boolean;
};

export class OAuthVerificationError extends Error {}

// ── Google ────────────────────────────────────────────────────────────────────

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

// Cached across requests by jose, which also handles key rotation. Created lazily
// so importing this module never opens a socket — tests and the build do not.
let googleJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
const getGoogleJwks = () =>
  (googleJwks ??= createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")));

/**
 * Every client id that may legitimately have minted a token for us.
 *
 * Native Google sign-in does **not** use the web client id: iOS and Android each
 * get their own, and the `aud` claim carries whichever one started the flow. So
 * the audience check is against a set. It is still a closed set — accepting any
 * audience would accept an ID token minted for someone else's app entirely,
 * which is the whole attack this check prevents.
 */
function googleAudiences(): string[] {
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_ID_IOS,
    process.env.GOOGLE_CLIENT_ID_ANDROID,
  ].filter((v): v is string => !!v && v.length > 0);
}

async function verifyGoogle(idToken: string): Promise<OAuthIdentity> {
  const audiences = googleAudiences();
  if (audiences.length === 0) {
    // Refusing here rather than verifying without an audience: a missing config
    // must fail closed, not silently widen what we accept.
    throw new OAuthVerificationError("Google prijava nije podešena na serveru.");
  }

  let payload;
  try {
    // jose checks the signature against Google's published keys, plus iss, aud
    // and exp. There is no step here we are trusting the caller for.
    ({ payload } = await jwtVerify(idToken, getGoogleJwks(), {
      issuer:   GOOGLE_ISSUERS,
      audience: audiences,
    }));
  } catch (err) {
    logger.warn({ err }, "google id token rejected");
    throw new OAuthVerificationError("Google prijava nije uspela.");
  }

  const sub = typeof payload.sub === "string" ? payload.sub : null;
  if (!sub) throw new OAuthVerificationError("Google prijava nije uspela.");

  return {
    provider:          "google",
    providerAccountId: sub,
    email:             typeof payload.email === "string" ? payload.email.toLowerCase() : null,
    name:              typeof payload.name === "string" ? payload.name : null,
    image:             typeof payload.picture === "string" ? payload.picture : null,
    emailVerified:     payload.email_verified === true,
  };
}

// ── Facebook ──────────────────────────────────────────────────────────────────

type DebugTokenResponse = {
  data?: { app_id?: string; is_valid?: boolean; user_id?: string };
};

/**
 * Facebook hands out an opaque access token, not a JWT, so verification is a
 * call to the provider rather than a signature check.
 *
 * `debug_token` is the load-bearing half. Calling /me with the token proves only
 * that the token is valid *somewhere* — a token minted for any other Facebook
 * app would answer /me perfectly well, and accepting it lets the owner of that
 * other app sign in as any of its users here. debug_token is what pins the token
 * to our app id.
 */
async function verifyFacebook(accessToken: string): Promise<OAuthIdentity> {
  const appId     = process.env.FACEBOOK_CLIENT_ID;
  const appSecret = process.env.FACEBOOK_CLIENT_SECRET;
  if (!appId || !appSecret) {
    throw new OAuthVerificationError("Facebook prijava nije podešena na serveru.");
  }

  const debugUrl = new URL("https://graph.facebook.com/debug_token");
  debugUrl.searchParams.set("input_token", accessToken);
  debugUrl.searchParams.set("access_token", `${appId}|${appSecret}`);

  let debug: DebugTokenResponse;
  try {
    const res = await fetch(debugUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`debug_token ${res.status}`);
    debug = (await res.json()) as DebugTokenResponse;
  } catch (err) {
    logger.warn({ err }, "facebook debug_token failed");
    throw new OAuthVerificationError("Facebook prijava nije uspela.");
  }

  if (debug.data?.is_valid !== true || debug.data.app_id !== appId || !debug.data.user_id) {
    logger.warn(
      { appIdMatches: debug.data?.app_id === appId, isValid: debug.data?.is_valid },
      "facebook token rejected",
    );
    throw new OAuthVerificationError("Facebook prijava nije uspela.");
  }

  const meUrl = new URL("https://graph.facebook.com/me");
  meUrl.searchParams.set("fields", "id,name,email");
  meUrl.searchParams.set("access_token", accessToken);

  let me: { id?: string; name?: string; email?: string };
  try {
    const res = await fetch(meUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`me ${res.status}`);
    me = (await res.json()) as typeof me;
  } catch (err) {
    logger.warn({ err }, "facebook /me failed");
    throw new OAuthVerificationError("Facebook prijava nije uspela.");
  }

  // The identity is debug_token's user_id, not /me's — they are the same when
  // everything is honest, and user_id is the one we just pinned to our app.
  if (me.id && me.id !== debug.data.user_id) {
    logger.warn("facebook /me id disagrees with debug_token user_id");
    throw new OAuthVerificationError("Facebook prijava nije uspela.");
  }

  return {
    provider:          "facebook",
    providerAccountId: debug.data.user_id,
    email:             me.email ? me.email.toLowerCase() : null,
    name:              me.name ?? null,
    image:             null,
    // Facebook returns an email only once the user confirmed it, but does not
    // expose a separate verified flag. Treated as unverified: this value decides
    // whether an existing account may be matched by email, and that is not a
    // decision to make on an assumption.
    emailVerified:     false,
  };
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function verifyOAuthToken(
  provider: "google" | "facebook",
  token: string,
): Promise<OAuthIdentity> {
  return provider === "google" ? verifyGoogle(token) : verifyFacebook(token);
}
