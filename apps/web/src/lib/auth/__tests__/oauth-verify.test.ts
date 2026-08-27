import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { SignJWT, generateKeyPair, exportJWK, type JWK, type KeyLike } from "jose";

vi.mock("@/lib/core/logger", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

/**
 * These tests forge tokens on purpose.
 *
 * A key pair stands in for Google's. Only `createRemoteJWKSet` is mocked — it is
 * swapped for jose's own `createLocalJWKSet` over the test public key, because
 * jose v4 fetches the key set over node's http module rather than global fetch,
 * so stubbing fetch would not intercept it. Everything that decides whether a
 * token is acceptable — signature, `aud`, `iss`, `exp` — is the real jose
 * implementation. A token signed by the wrong key, or carrying the wrong
 * audience, fails here for the reason it would in production, not because a
 * mock said so.
 */
let currentJwks: { keys: JWK[] } = { keys: [] };

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    createRemoteJWKSet: () => actual.createLocalJWKSet(currentJwks),
  };
});

import { verifyOAuthToken, OAuthVerificationError } from "../oauth-verify";

const REAL_AUD  = "ekonobar-web.apps.googleusercontent.com";
const IOS_AUD   = "ekonobar-ios.apps.googleusercontent.com";
const OTHER_AUD = "someone-elses-app.apps.googleusercontent.com";

let privateKey: KeyLike;
let publicJwk: JWK;
/** A second pair nobody published — used to sign an unmistakably forged token. */
let attackerKey: KeyLike;

// One key pair for the whole file. oauth-verify caches its key set on first use
// — as it should, since Google's keys are stable and refetching them per request
// would be an own goal — so regenerating keys per test would leave the cache
// holding a public key that no longer matches what the tokens are signed with.
beforeAll(async () => {
  const real = await generateKeyPair("RS256");
  privateKey = real.privateKey;
  publicJwk  = { ...(await exportJWK(real.publicKey)), alg: "RS256", kid: "test-key" };
  currentJwks = { keys: [publicJwk] };

  attackerKey = (await generateKeyPair("RS256")).privateKey;
});

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID     = REAL_AUD;
  process.env.GOOGLE_CLIENT_ID_IOS = IOS_AUD;
  delete process.env.GOOGLE_CLIENT_ID_ANDROID;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type Claims = { aud?: string; iss?: string; sub?: string; email?: string; email_verified?: boolean };

async function googleToken(claims: Claims = {}, key: KeyLike = privateKey) {
  return new SignJWT({
    email:          claims.email ?? "marko@test.com",
    email_verified: claims.email_verified ?? true,
    name:           "Marko",
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(claims.iss ?? "https://accounts.google.com")
    .setAudience(claims.aud ?? REAL_AUD)
    .setSubject(claims.sub ?? "google-sub-1")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

describe("verifyOAuthToken — google", () => {
  it("accepts a well-formed token for our web client id", async () => {
    const identity = await verifyOAuthToken("google", await googleToken());

    expect(identity).toMatchObject({
      provider:          "google",
      providerAccountId: "google-sub-1",
      email:             "marko@test.com",
      emailVerified:     true,
    });
  });

  it("accepts a token for the iOS client id", async () => {
    // Native Google sign-in does not use the web client id, so the audience
    // check has to be a set — but a closed one.
    const identity = await verifyOAuthToken("google", await googleToken({ aud: IOS_AUD }));
    expect(identity.providerAccountId).toBe("google-sub-1");
  });

  it("rejects a token minted for a different application", async () => {
    // Otherwise any Google developer could sign their own users into eKonobar.
    await expect(verifyOAuthToken("google", await googleToken({ aud: OTHER_AUD })))
      .rejects.toBeInstanceOf(OAuthVerificationError);
  });

  it("rejects a token signed by a key Google never published", async () => {
    await expect(verifyOAuthToken("google", await googleToken({}, attackerKey)))
      .rejects.toBeInstanceOf(OAuthVerificationError);
  });

  it("rejects a token from the wrong issuer", async () => {
    await expect(verifyOAuthToken("google", await googleToken({ iss: "https://evil.example" })))
      .rejects.toBeInstanceOf(OAuthVerificationError);
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({ email: "marko@test.com" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer("https://accounts.google.com")
      .setAudience(REAL_AUD)
      .setSubject("google-sub-1")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(privateKey);

    await expect(verifyOAuthToken("google", expired))
      .rejects.toBeInstanceOf(OAuthVerificationError);
  });

  it("carries email_verified: false through rather than assuming", async () => {
    const identity = await verifyOAuthToken(
      "google",
      await googleToken({ email_verified: false }),
    );
    expect(identity.emailVerified).toBe(false);
  });

  it("fails closed when no client id is configured", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID_IOS;

    // A missing config must not widen what we accept to "any audience".
    await expect(verifyOAuthToken("google", await googleToken()))
      .rejects.toBeInstanceOf(OAuthVerificationError);
  });
});

describe("verifyOAuthToken — facebook", () => {
  const APP_ID = "fb-app-1";

  function stubGraph(debugData: Record<string, unknown>, me: Record<string, unknown> = {}) {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("debug_token")) {
        return new Response(JSON.stringify({ data: debugData }), { status: 200 });
      }
      if (url.includes("graph.facebook.com/me")) {
        return new Response(JSON.stringify(me), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }));
  }

  beforeEach(() => {
    process.env.FACEBOOK_CLIENT_ID     = APP_ID;
    process.env.FACEBOOK_CLIENT_SECRET = "fb-secret";
  });

  it("accepts a token our own app issued", async () => {
    stubGraph(
      { app_id: APP_ID, is_valid: true, user_id: "fb-1" },
      { id: "fb-1", name: "Marko", email: "Marko@Test.com" },
    );

    const identity = await verifyOAuthToken("facebook", "fb-token");

    expect(identity).toMatchObject({
      provider:          "facebook",
      providerAccountId: "fb-1",
      email:             "marko@test.com",
      // Facebook exposes no verified flag, so this is never assumed true.
      emailVerified:     false,
    });
  });

  it("rejects a token issued for a different Facebook app", async () => {
    // /me would answer this token perfectly well — debug_token is the only
    // thing standing between us and the owner of that other app signing in as
    // any of its users.
    stubGraph(
      { app_id: "some-other-app", is_valid: true, user_id: "fb-1" },
      { id: "fb-1", name: "Marko" },
    );

    await expect(verifyOAuthToken("facebook", "fb-token"))
      .rejects.toBeInstanceOf(OAuthVerificationError);
  });

  it("rejects a token Facebook reports as invalid", async () => {
    stubGraph({ app_id: APP_ID, is_valid: false, user_id: "fb-1" });
    await expect(verifyOAuthToken("facebook", "fb-token"))
      .rejects.toBeInstanceOf(OAuthVerificationError);
  });

  it("rejects when /me disagrees with debug_token about who this is", async () => {
    stubGraph(
      { app_id: APP_ID, is_valid: true, user_id: "fb-1" },
      { id: "fb-999", name: "Neko drugi" },
    );

    await expect(verifyOAuthToken("facebook", "fb-token"))
      .rejects.toBeInstanceOf(OAuthVerificationError);
  });

  it("fails closed when the app secret is missing", async () => {
    delete process.env.FACEBOOK_CLIENT_SECRET;
    await expect(verifyOAuthToken("facebook", "fb-token"))
      .rejects.toBeInstanceOf(OAuthVerificationError);
  });
});
