import { PrismaClient } from "@prisma/client";

/**
 * Strips the password from a connection string before it is printed.
 *
 * Both messages below name the database so a wrong-target mistake is obvious,
 * and both end up in CI logs and terminal scrollback. Interpolating the raw
 * DATABASE_URL there published the password every time the connection failed.
 *
 * Deliberately tolerant of a malformed URL: this runs on the failure path, so
 * throwing here would replace a useful error with a confusing one. Anything it
 * cannot parse is reported as a placeholder rather than echoed.
 */
export function redactDbUrl(url: string): string {
  // Split userinfo on the LAST '@' — an unencoded '@' inside a password would
  // otherwise be mistaken for the userinfo/host separator and leak the tail.
  const at = url.lastIndexOf("@");
  const schemeEnd = url.indexOf("://");
  if (at === -1 || schemeEnd === -1 || at < schemeEnd) return "<unparseable DATABASE_URL>";

  const userinfo = url.slice(schemeEnd + 3, at);
  const colon    = userinfo.indexOf(":");
  if (colon === -1) return url; // no password present

  return `${url.slice(0, schemeEnd + 3)}${userinfo.slice(0, colon)}:***@${url.slice(at + 1)}`;
}

/**
 * Scrubs any connection string embedded in a longer piece of text.
 *
 * redactDbUrl expects the whole string to be a URL; a driver error is a sentence
 * with a URL somewhere inside it, so passing the message there would return the
 * "unparseable" placeholder and throw away the diagnostic. This keeps the prose
 * and replaces only the credential.
 */
export function redactAnyDbUrl(text: string): string {
  // The password segment is `\S*` (greedy) rather than `[^@\s]*` on purpose:
  // a password containing an unencoded '@' — which this project's own URL has —
  // would otherwise match only up to that first '@' and leave the remainder in
  // the text. Greedy `\S*` backtracks to the LAST '@' in the whitespace-delimited
  // token, which is the real userinfo/host boundary.
  return text.replace(/(postgres(?:ql)?:\/\/[^:\s]+):\S*@(\S*)/gi, "$1:***@$2");
}

// Runs once before all integration tests in the project.
// CI applies migrations via `npx prisma migrate deploy` before this runs.
// Locally: start `docker compose up -d` and run `npm run db:push` first.
export async function setup() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "[integration] DATABASE_URL not set.\n" +
      "Start Docker Compose and apply migrations before running integration tests:\n" +
      "  docker compose up -d\n" +
      "  npm run db:push",
    );
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    await prisma.$connect();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[integration] Cannot connect to PostgreSQL at ${redactDbUrl(url)}.\n` +
      `Run: docker compose up -d\n` +
      // The driver echoes the connection string inside its own message in some
      // failure modes, so the provider's text needs scrubbing too — not just ours.
      `Original error: ${redactAnyDbUrl(msg)}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function teardown() {
  // Per-test cleanup is handled by resetDb() in each test file's beforeEach.
  // Worker connection pools are closed automatically when Vitest exits.
}
