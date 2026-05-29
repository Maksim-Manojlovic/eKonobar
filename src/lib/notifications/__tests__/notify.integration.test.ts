import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock only the network dispatchers — DB interactions stay real.
// Unit test mocked db.user.findUnique, so tier gating was never checked
// against real passport rows. This test proves runtime resolution from DB.
vi.mock("@/lib/notifications/dispatch", () => ({
  dispatchPush:     vi.fn().mockResolvedValue(false),
  dispatchWhatsApp: vi.fn().mockResolvedValue(true),
  dispatchSms:      vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/integrations/email", () => ({
  sendNotificationEmail: vi.fn().mockResolvedValue(undefined),
}));

import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { dbRaw } from "@/lib/core/db";
import { dispatchWhatsApp, dispatchSms } from "@/lib/notifications/dispatch";
import { notify } from "../notify";

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const PAST   = new Date(Date.now() -  5 * 24 * 60 * 60 * 1000);

async function seedWaiter(opts: {
  passportTier?: "FREE" | "PRO" | "PRO_PLUS";
  subscriptionExpiresAt?: Date | null;
  waOptIn?: boolean;
  smsOptIn?: boolean;
  phone?: string | null;
} = {}) {
  const userId = await seedUser({ role: "WAITER" });
  await dbRaw.user.update({
    where: { id: userId },
    data: {
      // Use !== undefined so explicit null is preserved (not replaced by default)
      phone:    opts.phone    !== undefined ? opts.phone    : "+381611234567",
      waOptIn:  opts.waOptIn  !== undefined ? opts.waOptIn  : true,
      smsOptIn: opts.smsOptIn !== undefined ? opts.smsOptIn : true,
    },
  });
  await dbRaw.waiterPassport.create({
    data: {
      userId,
      passportTier:          opts.passportTier          ?? "FREE",
      subscriptionExpiresAt: opts.subscriptionExpiresAt ?? null,
    },
  });
  return userId;
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  // Default: dispatchers succeed
  vi.mocked(dispatchWhatsApp).mockResolvedValue(true);
  vi.mocked(dispatchSms).mockResolvedValue(true);
});

// ── Notification DB write ─────────────────────────────────────────────────────

describe("notify — real DB writes", () => {
  it("creates Notification row in DB", async () => {
    const userId = await seedWaiter({ passportTier: "FREE" });
    await notify(userId, "APPLICATION_RECEIVED", "Title", "Body", "/link");

    const rows = await dbRaw.notification.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Title");
    expect(rows[0].body).toBe("Body");
    expect(rows[0].link).toBe("/link");
    expect(rows[0].type).toBe("APPLICATION_RECEIVED");
  });

  it("soft-deleted user → returns early, no Notification row created", async () => {
    const userId = await seedUser({ role: "WAITER" });
    await dbRaw.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });
    await dbRaw.waiterPassport.create({ data: { userId } });

    await notify(userId, "APPLICATION_RECEIVED", "T", "B");

    // db.user.findUnique filters deletedAt → null → early return
    const rows = await dbRaw.notification.findMany({ where: { userId } });
    expect(rows).toHaveLength(0);
  });

  it("sets waSent=true in DB after successful WhatsApp dispatch", async () => {
    const userId = await seedWaiter({ passportTier: "PRO", subscriptionExpiresAt: FUTURE });
    await notify(userId, "APPLICATION_RECEIVED", "T", "B");

    const row = await dbRaw.notification.findFirst({ where: { userId } });
    expect(row!.waSent).toBe(true);
  });

  it("increments waRetries when WhatsApp fails", async () => {
    vi.mocked(dispatchWhatsApp).mockResolvedValue(false);
    const userId = await seedWaiter({ passportTier: "PRO", subscriptionExpiresAt: FUTURE });
    await notify(userId, "APPLICATION_RECEIVED", "T", "B");

    const row = await dbRaw.notification.findFirst({ where: { userId } });
    expect(row!.waSent).toBe(false);
    expect(row!.waRetries).toBe(1);
  });

  it("sets smsSent=true in DB after successful SMS dispatch", async () => {
    const userId = await seedWaiter({ passportTier: "PRO_PLUS", subscriptionExpiresAt: FUTURE });
    await notify(userId, "APPLICATION_RECEIVED", "T", "B");

    const row = await dbRaw.notification.findFirst({ where: { userId } });
    expect(row!.smsSent).toBe(true);
  });
});

// ── Tier gating — reads real WaiterPassport rows ──────────────────────────────

describe("notify — tier gating from real DB", () => {
  it("FREE waiter → neither WhatsApp nor SMS dispatched", async () => {
    const userId = await seedWaiter({ passportTier: "FREE" });
    await notify(userId, "APPLICATION_RECEIVED", "T", "B");
    expect(dispatchWhatsApp).not.toHaveBeenCalled();
    expect(dispatchSms).not.toHaveBeenCalled();
  });

  it("PRO waiter (active) → WhatsApp dispatched, SMS not", async () => {
    const userId = await seedWaiter({ passportTier: "PRO", subscriptionExpiresAt: FUTURE });
    await notify(userId, "APPLICATION_RECEIVED", "T", "B");
    expect(dispatchWhatsApp).toHaveBeenCalledTimes(1);
    expect(dispatchSms).not.toHaveBeenCalled();
  });

  it("PRO_PLUS waiter (active) → both WhatsApp and SMS dispatched", async () => {
    const userId = await seedWaiter({ passportTier: "PRO_PLUS", subscriptionExpiresAt: FUTURE });
    await notify(userId, "APPLICATION_RECEIVED", "T", "B");
    expect(dispatchWhatsApp).toHaveBeenCalledTimes(1);
    expect(dispatchSms).toHaveBeenCalledTimes(1);
  });

  it("PRO_PLUS with EXPIRED subscription → treated as FREE (real runtime resolution)", async () => {
    // This is the critical case: passportTier=PRO_PLUS in DB but subscriptionExpiresAt in past.
    // getEffectiveTier() must downgrade to FREE at runtime. Mocked unit tests always
    // returned the tier field directly — this test proves the expiry check runs against real data.
    const userId = await seedWaiter({ passportTier: "PRO_PLUS", subscriptionExpiresAt: PAST });
    await notify(userId, "APPLICATION_RECEIVED", "T", "B");
    expect(dispatchWhatsApp).not.toHaveBeenCalled();
    expect(dispatchSms).not.toHaveBeenCalled();
  });

  it("PRO with expired subscription → treated as FREE — no WhatsApp", async () => {
    const userId = await seedWaiter({ passportTier: "PRO", subscriptionExpiresAt: PAST });
    await notify(userId, "APPLICATION_RECEIVED", "T", "B");
    expect(dispatchWhatsApp).not.toHaveBeenCalled();
  });

  it("waOptIn=false suppresses WhatsApp for PRO", async () => {
    const userId = await seedWaiter({
      passportTier: "PRO", subscriptionExpiresAt: FUTURE, waOptIn: false,
    });
    await notify(userId, "APPLICATION_RECEIVED", "T", "B");
    expect(dispatchWhatsApp).not.toHaveBeenCalled();
  });

  it("smsOptIn=false suppresses SMS for PRO_PLUS", async () => {
    const userId = await seedWaiter({
      passportTier: "PRO_PLUS", subscriptionExpiresAt: FUTURE, smsOptIn: false,
    });
    await notify(userId, "APPLICATION_RECEIVED", "T", "B");
    expect(dispatchSms).not.toHaveBeenCalled();
  });

  it("no phone suppresses WhatsApp and SMS even for PRO_PLUS", async () => {
    const userId = await seedWaiter({
      passportTier: "PRO_PLUS", subscriptionExpiresAt: FUTURE, phone: null,
    });
    await notify(userId, "APPLICATION_RECEIVED", "T", "B");
    expect(dispatchWhatsApp).not.toHaveBeenCalled();
    expect(dispatchSms).not.toHaveBeenCalled();
  });

  it("VENUE_OWNER bypasses tier gating — all channels regardless of no passport", async () => {
    const ownerId = await seedUser({ role: "VENUE_OWNER" });
    await dbRaw.user.update({
      where: { id: ownerId },
      data: { phone: "+381611111111", waOptIn: true, smsOptIn: true },
    });
    // No WaiterPassport created — owner has no passport, but tier gating doesn't apply
    await notify(ownerId, "APPLICATION_RECEIVED", "T", "B");
    expect(dispatchWhatsApp).toHaveBeenCalledTimes(1);
    expect(dispatchSms).toHaveBeenCalledTimes(1);
  });
});
