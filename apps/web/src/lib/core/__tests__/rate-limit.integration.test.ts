import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { rateLimit, resetRateLimit, checkRateLimit } from "../rate-limit";
import { dbRaw } from "@/lib/core/db";

// These tests validate the real PostgreSQL ON CONFLICT DO UPDATE SQL.
// No mocks — the only thing unit tests couldn't prove is that the raw
// upsert SQL is syntactically valid and semantically correct.

beforeEach(async () => {
  await resetDb();
});

// ── rateLimit (AnonRateLimit, no FK) ─────────────────────────────────────────

describe("rateLimit — real ON CONFLICT upsert", () => {
  it("first call: count=1 ≤ max → true", async () => {
    expect(await rateLimit("guest_review:1.2.3.4", 3, 60_000)).toBe(true);
  });

  it("calls increment counter; exceeding max → false", async () => {
    await rateLimit("forgot:1.2.3.4", 3, 60_000); // 1
    await rateLimit("forgot:1.2.3.4", 3, 60_000); // 2
    await rateLimit("forgot:1.2.3.4", 3, 60_000); // 3 — still allowed
    expect(await rateLimit("forgot:1.2.3.4", 3, 60_000)).toBe(false); // 4 > 3
  });

  it("exactly at max → true (boundary inclusive)", async () => {
    await rateLimit("login:ip:1.1.1.1", 2, 60_000); // 1
    expect(await rateLimit("login:ip:1.1.1.1", 2, 60_000)).toBe(true); // 2 == max
  });

  it("counter row written to AnonRateLimit table", async () => {
    await rateLimit("test:persist", 5, 60_000);
    await rateLimit("test:persist", 5, 60_000);
    const rows = await dbRaw.$queryRaw<[{ count: bigint }]>`
      SELECT count FROM "AnonRateLimit" WHERE key = ${"test:persist"}
    `;
    expect(Number(rows[0].count)).toBe(2);
  });

  it("different keys have independent counters", async () => {
    await rateLimit("key:a", 1, 60_000); // 1 (allowed)
    await rateLimit("key:a", 1, 60_000); // 2 (blocked)
    expect(await rateLimit("key:b", 1, 60_000)).toBe(true); // key:b at 1 → allowed
  });

  it("concurrent inserts converge to correct count via ON CONFLICT", async () => {
    // Fire 5 concurrent requests — PostgreSQL serializes upsert; no lost updates
    await Promise.all(
      Array.from({ length: 5 }, () => rateLimit("concurrent:test", 10, 60_000)),
    );
    const rows = await dbRaw.$queryRaw<[{ count: bigint }]>`
      SELECT count FROM "AnonRateLimit" WHERE key = ${"concurrent:test"}
    `;
    expect(Number(rows[0].count)).toBe(5);
  });
});

// ── resetRateLimit ─────────────────────────────────────────────────────────────

describe("resetRateLimit", () => {
  it("deletes records for key — counter restarts from 1", async () => {
    await rateLimit("reset:me", 1, 60_000); // 1 → allowed
    await rateLimit("reset:me", 1, 60_000); // 2 → now blocked
    expect(await rateLimit("reset:me", 1, 60_000)).toBe(false);

    await resetRateLimit("reset:me");
    expect(await rateLimit("reset:me", 1, 60_000)).toBe(true); // counter at 1 again
  });

  it("does not touch records for other keys", async () => {
    await rateLimit("keep:me", 5, 60_000);
    await rateLimit("keep:me", 5, 60_000);
    await resetRateLimit("delete:me"); // different key

    const rows = await dbRaw.$queryRaw<[{ count: bigint }]>`
      SELECT count FROM "AnonRateLimit" WHERE key = ${"keep:me"}
    `;
    expect(Number(rows[0].count)).toBe(2);
  });
});

// ── checkRateLimit (RateLimit, userId FK) ────────────────────────────────────

describe("checkRateLimit — post-auth with real FK constraint", () => {
  let userId: string;

  beforeEach(async () => {
    userId = await seedUser();
  });

  it("first call → true", async () => {
    expect(await checkRateLimit(userId, "post_review", 5)).toBe(true);
  });

  it("exceeds max → false", async () => {
    for (let i = 0; i < 5; i++) await checkRateLimit(userId, "post_review", 5);
    expect(await checkRateLimit(userId, "post_review", 5)).toBe(false); // 6th
  });

  it("counter persisted to RateLimit table", async () => {
    await checkRateLimit(userId, "apply_job", 10);
    await checkRateLimit(userId, "apply_job", 10);
    const row = await dbRaw.rateLimit.findFirst({ where: { userId, action: "apply_job" } });
    expect(row!.count).toBe(2);
  });

  it("different actions are independent per user", async () => {
    for (let i = 0; i < 5; i++) await checkRateLimit(userId, "post_review", 5);
    await checkRateLimit(userId, "post_review", 5); // 6th → blocked

    // apply_job counter untouched — first call allowed
    expect(await checkRateLimit(userId, "apply_job", 10)).toBe(true);
  });

  it("different users have independent counters for same action", async () => {
    const userId2 = await seedUser();
    for (let i = 0; i < 5; i++) await checkRateLimit(userId, "post_review", 5);
    await checkRateLimit(userId, "post_review", 5); // userId blocked

    // userId2 counter at 0 — still allowed
    expect(await checkRateLimit(userId2, "post_review", 5)).toBe(true);
  });

  it("nonexistent userId violates FK constraint", async () => {
    await expect(
      checkRateLimit("nonexistent-user-id", "post_review", 5),
    ).rejects.toThrow();
  });
});
