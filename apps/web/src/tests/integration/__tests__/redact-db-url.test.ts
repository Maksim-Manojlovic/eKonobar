import { describe, it, expect } from "vitest";
import { redactDbUrl, redactAnyDbUrl } from "../setup";

/**
 * These two functions exist because the integration bootstrap used to interpolate
 * the raw DATABASE_URL into its failure message, which published the database
 * password into CI logs and terminal scrollback on every failed connection.
 */

const PASSWORD_WITH_AT = "F@Bk5L7Mc&hchMB";

describe("redactDbUrl", () => {
  it("replaces the password and keeps everything else", () => {
    expect(redactDbUrl("postgresql://user:hunter2@db.example.com:5432/app"))
      .toBe("postgresql://user:***@db.example.com:5432/app");
  });

  it("handles an unencoded '@' inside the password", () => {
    // This is the real shape of the project's own URL. Splitting on the FIRST
    // '@' would treat part of the password as the host and leak the rest.
    const out = redactDbUrl(`postgresql://user:${PASSWORD_WITH_AT}@db.example.com:5432/app`);

    expect(out).toBe("postgresql://user:***@db.example.com:5432/app");
    expect(out).not.toContain("Bk5L7Mc");
  });

  it("keeps query parameters", () => {
    expect(redactDbUrl("postgresql://u:p@host:6543/postgres?pgbouncer=true"))
      .toBe("postgresql://u:***@host:6543/postgres?pgbouncer=true");
  });

  it("passes through a URL that carries no password", () => {
    expect(redactDbUrl("postgresql://user@localhost:5432/app"))
      .toBe("postgresql://user@localhost:5432/app");
  });

  it("returns a placeholder rather than echoing something it cannot parse", () => {
    expect(redactDbUrl("not-a-url-at-all")).toBe("<unparseable DATABASE_URL>");
  });
});

describe("redactAnyDbUrl", () => {
  it("scrubs a URL embedded in prose without destroying the prose", () => {
    const msg = `Error querying the database: FATAL: cannot connect to postgresql://user:${PASSWORD_WITH_AT}@aws-0.pooler.supabase.com:6543/postgres - retry later`;

    const out = redactAnyDbUrl(msg);

    expect(out).toContain("Error querying the database");
    expect(out).toContain("retry later");
    expect(out).not.toContain("Bk5L7Mc");
    expect(out).toContain(":***@");
  });

  it("leaves a message with no connection string untouched", () => {
    expect(redactAnyDbUrl("ECONNREFUSED 127.0.0.1:5432")).toBe("ECONNREFUSED 127.0.0.1:5432");
  });

  it("scrubs every occurrence, not just the first", () => {
    const out = redactAnyDbUrl(
      "tried postgres://a:secret1@h1/db then postgresql://b:secret2@h2/db",
    );
    expect(out).not.toContain("secret1");
    expect(out).not.toContain("secret2");
  });
});
