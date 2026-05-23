import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    user:             { findUnique: vi.fn() },
    notification:     { create: vi.fn(), update: vi.fn() },
    pushSubscription: { delete: vi.fn() },
  },
}));
vi.mock("@/lib/webpush",   () => ({ sendPush:     vi.fn() }));
vi.mock("@/lib/whatsapp",  () => ({ sendWhatsApp: vi.fn() }));
vi.mock("@/lib/sms",       () => ({ sendSms:      vi.fn() }));
vi.mock("@prisma/client",  () => ({
  NotificationType: { APPLICATION_RECEIVED: "APPLICATION_RECEIVED" },
}));

import { db } from "@/lib/db";
import { sendPush }     from "@/lib/webpush";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendSms }      from "@/lib/sms";
import { notify }       from "../notify";

const NOTIF_ID = "n-1";
const FUTURE   = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const PAST     = new Date(Date.now() -  5 * 24 * 60 * 60 * 1000);

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    role: "WAITER",
    phone: "+381611234567",
    smsOptIn: true,
    waOptIn: true,
    pushSubscriptions: [],
    waiterPassport: { passportTier: "PRO_PLUS", subscriptionExpiresAt: FUTURE },
    ...overrides,
  };
}

describe("notify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue(makeUser() as never);
    vi.mocked(db.notification.create).mockResolvedValue({ id: NOTIF_ID } as never);
    vi.mocked(db.notification.update).mockResolvedValue(undefined as never);
    vi.mocked(sendPush).mockResolvedValue(undefined);
    vi.mocked(sendWhatsApp).mockResolvedValue(undefined);
    vi.mocked(sendSms).mockResolvedValue(undefined);
  });

  it("returns early when user not found (soft-deleted)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    await notify("ghost", "APPLICATION_RECEIVED" as never, "T", "B");
    expect(vi.mocked(db.notification.create)).not.toHaveBeenCalled();
  });

  it("always creates notification DB record", async () => {
    await notify("u-1", "APPLICATION_RECEIVED" as never, "Title", "Body", "/link");
    expect(vi.mocked(db.notification.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "u-1", title: "Title", body: "Body", link: "/link" }),
      }),
    );
  });

  it("no link -> link: null in DB record", async () => {
    await notify("u-1", "APPLICATION_RECEIVED" as never, "Title", "Body");
    expect(vi.mocked(db.notification.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ link: null }) }),
    );
  });

  it("sends WhatsApp to PRO_PLUS waiter with waOptIn + phone", async () => {
    await notify("u-1", "APPLICATION_RECEIVED" as never, "Title", "Body");
    expect(vi.mocked(sendWhatsApp)).toHaveBeenCalledWith("+381611234567", "Title", "Body");
  });

  it("sends SMS to PRO_PLUS waiter with smsOptIn + phone", async () => {
    await notify("u-1", "APPLICATION_RECEIVED" as never, "Title", "Body");
    expect(vi.mocked(sendSms)).toHaveBeenCalledTimes(1);
  });

  it("PRO tier waiter gets WhatsApp but not SMS", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(
      makeUser({ waiterPassport: { passportTier: "PRO", subscriptionExpiresAt: FUTURE } }) as never,
    );
    await notify("u-1", "APPLICATION_RECEIVED" as never, "T", "B");
    expect(vi.mocked(sendWhatsApp)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendSms)).not.toHaveBeenCalled();
  });

  it("FREE tier waiter gets no WhatsApp and no SMS", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(
      makeUser({ waiterPassport: { passportTier: "FREE", subscriptionExpiresAt: null } }) as never,
    );
    await notify("u-1", "APPLICATION_RECEIVED" as never, "T", "B");
    expect(vi.mocked(sendWhatsApp)).not.toHaveBeenCalled();
    expect(vi.mocked(sendSms)).not.toHaveBeenCalled();
  });

  it("expired PRO_PLUS treated as FREE — no WA, no SMS", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(
      makeUser({ waiterPassport: { passportTier: "PRO_PLUS", subscriptionExpiresAt: PAST } }) as never,
    );
    await notify("u-1", "APPLICATION_RECEIVED" as never, "T", "B");
    expect(vi.mocked(sendWhatsApp)).not.toHaveBeenCalled();
    expect(vi.mocked(sendSms)).not.toHaveBeenCalled();
  });

  it("waOptIn=false skips WhatsApp even for PRO_PLUS", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(
      makeUser({ waOptIn: false }) as never,
    );
    await notify("u-1", "APPLICATION_RECEIVED" as never, "T", "B");
    expect(vi.mocked(sendWhatsApp)).not.toHaveBeenCalled();
  });

  it("smsOptIn=false skips SMS even for PRO_PLUS", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(
      makeUser({ smsOptIn: false }) as never,
    );
    await notify("u-1", "APPLICATION_RECEIVED" as never, "T", "B");
    expect(vi.mocked(sendSms)).not.toHaveBeenCalled();
  });

  it("VENUE_OWNER gets all channels regardless of passport (no tier gating)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(
      makeUser({ role: "VENUE_OWNER", waiterPassport: null }) as never,
    );
    await notify("o-1", "APPLICATION_RECEIVED" as never, "T", "B");
    expect(vi.mocked(sendWhatsApp)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendSms)).toHaveBeenCalledTimes(1);
  });

  it("sends push for each subscription", async () => {
    const sub = { id: "sub-1", endpoint: "https://fcm/1", p256dh: "k1", auth: "a1" };
    vi.mocked(db.user.findUnique).mockResolvedValue(
      makeUser({ pushSubscriptions: [sub] }) as never,
    );
    await notify("u-1", "APPLICATION_RECEIVED" as never, "T", "B");
    expect(vi.mocked(sendPush)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendPush)).toHaveBeenCalledWith(sub, { title: "T", body: "B", link: undefined });
  });

  it("expired push subscription (410) auto-deleted", async () => {
    const sub = { id: "sub-1", endpoint: "https://fcm/1", p256dh: "k1", auth: "a1" };
    vi.mocked(db.user.findUnique).mockResolvedValue(
      makeUser({ pushSubscriptions: [sub] }) as never,
    );
    const err = Object.assign(new Error("Gone"), { statusCode: 410 });
    vi.mocked(sendPush).mockRejectedValue(err);
    await notify("u-1", "APPLICATION_RECEIVED" as never, "T", "B");
    expect(vi.mocked(db.pushSubscription.delete)).toHaveBeenCalledWith({ where: { id: "sub-1" } });
  });

  it("no phone -> WhatsApp not called", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(
      makeUser({ phone: null }) as never,
    );
    await notify("u-1", "APPLICATION_RECEIVED" as never, "T", "B");
    expect(vi.mocked(sendWhatsApp)).not.toHaveBeenCalled();
  });
});
