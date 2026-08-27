import { describe, it, expect, afterEach } from "vitest";
import { assertResettableDatabase } from "@/tests/integration/db-reset";

/**
 * CQ-AE guard. `resetDb()` TRUNCATEs every application table using whatever
 * `DATABASE_URL` is in `.env` — which on a developer machine is routinely the
 * shared Supabase instance. These tests pin the refusal, because the failure
 * mode is irreversible production data loss.
 *
 * Deliberately a unit test: it must run without a database, since its whole
 * purpose is to prove we do NOT touch the wrong one.
 */
const SUPABASE = "postgresql://postgres:pw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres";
const LOCAL    = "postgresql://postgres:pw@localhost:5432/ekonobar";

describe("resetDb destructive guard", () => {
  const originalUrl = process.env.DATABASE_URL;

  afterEach(() => {
    delete process.env.ALLOW_DESTRUCTIVE_DB_RESET;
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
  });

  it("refuses a remote managed database", () => {
    expect(() => assertResettableDatabase(SUPABASE)).toThrow(/REFUSING to TRUNCATE/);
  });

  it("names the host and database in the refusal so the mistake is obvious", () => {
    expect(() => assertResettableDatabase(SUPABASE)).toThrow(/pooler\.supabase\.com/);
  });

  it("allows localhost", () => {
    expect(() => assertResettableDatabase(LOCAL)).not.toThrow();
  });

  it("allows 127.0.0.1 and the docker-compose service host", () => {
    expect(() => assertResettableDatabase("postgresql://u:p@127.0.0.1:5432/ekonobar")).not.toThrow();
    expect(() => assertResettableDatabase("postgresql://u:p@db:5432/ekonobar")).not.toThrow();
  });

  it("allows a remote host when the database name marks it as a test DB", () => {
    expect(() =>
      assertResettableDatabase("postgresql://u:p@ci.example.com:5432/ekonobar_test"),
    ).not.toThrow();
  });

  it("allows an explicit opt-out for CI ephemeral databases", () => {
    process.env.ALLOW_DESTRUCTIVE_DB_RESET = "1";
    expect(() => assertResettableDatabase(SUPABASE)).not.toThrow();
  });

  it("defaults to reading DATABASE_URL when called with no argument", () => {
    process.env.DATABASE_URL = SUPABASE;
    expect(() => assertResettableDatabase()).toThrow(/REFUSING to TRUNCATE/);
  });

  it("refuses when DATABASE_URL is unset rather than defaulting to something", () => {
    delete process.env.DATABASE_URL;
    expect(() => assertResettableDatabase()).toThrow(/not set/);
  });

  it("refuses an unparseable DATABASE_URL", () => {
    expect(() => assertResettableDatabase("not-a-url")).toThrow(/not a parseable URL/);
  });
});
