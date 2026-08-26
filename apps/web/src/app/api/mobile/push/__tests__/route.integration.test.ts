import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth",         () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/redis",  () => ({ redis: null }));
// The only piece stubbed: the outbound HTTP call to Expo. Everything below it —
// the DB rows, dispatch, the status write — is real.
vi.mock("@/lib/integrations/expo-push", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrations/expo-push")>();
  return { ...actual, sendExpoPush: vi.fn() };
});

import { getServerSession } from "next-auth";
import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { dbRaw } from "@/lib/core/db";
import { sendExpoPush } from "@/lib/integrations/expo-push";
import { notify } from "@/lib/notifications/notify";

import { POST as register }   from "../register/route";
import { DELETE as unregister } from "../unregister/route";

const CTX = { params: Promise.resolve({}) };
const TOKEN = "ExponentPushToken[integration-abc]";

function bodyReq(path: string, method: string, body: unknown) {
  return new NextRequest(`http://localhost/api/mobile/push/${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function asUser(id: string, role: "WAITER" | "VENUE_OWNER" = "WAITER") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  vi.mocked(sendExpoPush).mockResolvedValue({ delivered: 1, invalidTokens: [] });
});

describe("POST /api/mobile/push/register", () => {
  it("stores the token and returns 204", async () => {
    const userId = await seedUser({ role: "WAITER" });
    asUser(userId);

    const res = await register(
      bodyReq("register", "POST", { token: TOKEN, platform: "ios", deviceId: "dev-1" }), CTX,
    );

    expect(res.status).toBe(204);
    const rows = await dbRaw.deviceToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId, token: TOKEN, platform: "ios", deviceId: "dev-1" });
  });

  it("is idempotent — re-registering the same token does not duplicate it", async () => {
    const userId = await seedUser({ role: "WAITER" });
    asUser(userId);
    const req = () => bodyReq("register", "POST", { token: TOKEN, platform: "ios", deviceId: "dev-1" });

    await register(req(), CTX);
    await register(req(), CTX);

    expect(await dbRaw.deviceToken.count()).toBe(1);
  });

  it("moves a token to the new owner when a device changes hands", async () => {
    const first  = await seedUser({ role: "WAITER" });
    const second = await seedUser({ role: "WAITER" });

    asUser(first);
    await register(bodyReq("register", "POST", { token: TOKEN, platform: "ios", deviceId: "dev-1" }), CTX);

    asUser(second);
    await register(bodyReq("register", "POST", { token: TOKEN, platform: "ios", deviceId: "dev-1" }), CTX);

    const rows = await dbRaw.deviceToken.findMany();
    expect(rows).toHaveLength(1);
    // Not duplicated across both accounts — the previous owner must stop
    // receiving notifications on a phone they no longer have.
    expect(rows[0].userId).toBe(second);
  });

  it("rejects a token that is not an Expo push token", async () => {
    asUser(await seedUser({ role: "WAITER" }));

    const res = await register(
      bodyReq("register", "POST", { token: "raw-fcm-token", platform: "ios", deviceId: "dev-1" }), CTX,
    );

    expect(res.status).toBe(400);
    expect(await dbRaw.deviceToken.count()).toBe(0);
  });

  it("401s without a session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const res = await register(
      bodyReq("register", "POST", { token: TOKEN, platform: "ios", deviceId: "dev-1" }), CTX,
    );
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/mobile/push/unregister", () => {
  it("removes the caller's token", async () => {
    const userId = await seedUser({ role: "WAITER" });
    asUser(userId);
    await register(bodyReq("register", "POST", { token: TOKEN, platform: "ios", deviceId: "dev-1" }), CTX);

    const res = await unregister(bodyReq("unregister", "DELETE", { token: TOKEN }), CTX);

    expect(res.status).toBe(204);
    expect(await dbRaw.deviceToken.count()).toBe(0);
  });

  it("cannot remove somebody else's token", async () => {
    const owner    = await seedUser({ role: "WAITER" });
    const attacker = await seedUser({ role: "WAITER" });

    asUser(owner);
    await register(bodyReq("register", "POST", { token: TOKEN, platform: "ios", deviceId: "dev-1" }), CTX);

    asUser(attacker);
    const res = await unregister(bodyReq("unregister", "DELETE", { token: TOKEN }), CTX);

    // 204 rather than 404 — the endpoint must not confirm that a token exists.
    expect(res.status).toBe(204);
    expect(await dbRaw.deviceToken.count()).toBe(1);
  });

  it("is idempotent for an unknown token", async () => {
    asUser(await seedUser({ role: "WAITER" }));

    const res = await unregister(bodyReq("unregister", "DELETE", { token: "ExponentPushToken[nope]" }), CTX);
    expect(res.status).toBe(204);
  });
});

describe("notify() fan-out to devices", () => {
  async function seedWithDevice() {
    const userId = await seedUser({ role: "WAITER" });
    asUser(userId);
    await register(bodyReq("register", "POST", { token: TOKEN, platform: "ios", deviceId: "dev-1" }), CTX);
    return userId;
  }

  it("sends to the registered device and records devicePushSent", async () => {
    const userId = await seedWithDevice();

    await notify(userId, "SHIFT_ASSIGNED", "Nova smena", "Sutra u 18h", "/waiter/smene");

    expect(sendExpoPush).toHaveBeenCalledWith(
      [TOKEN],
      { title: "Nova smena", body: "Sutra u 18h", link: "/waiter/smene" },
    );

    const [row] = await dbRaw.notification.findMany({ where: { userId } });
    expect(row.devicePushSent).toBe(true);
    expect(row.devicePushRetries).toBe(0);
  });

  it("increments devicePushRetries when the send fails", async () => {
    const userId = await seedWithDevice();
    vi.mocked(sendExpoPush).mockRejectedValue(new Error("expo down"));

    await notify(userId, "SHIFT_ASSIGNED", "Nova smena", "Sutra u 18h");

    const [row] = await dbRaw.notification.findMany({ where: { userId } });
    expect(row.devicePushSent).toBe(false);
    expect(row.devicePushRetries).toBe(1);
  });

  it("deletes a token the provider reports as permanently dead", async () => {
    const userId = await seedWithDevice();
    vi.mocked(sendExpoPush).mockResolvedValue({ delivered: 0, invalidTokens: [TOKEN] });

    await notify(userId, "SHIFT_ASSIGNED", "Nova smena", "Sutra u 18h");

    expect(await dbRaw.deviceToken.count()).toBe(0);
  });

  it("does not touch the device channel for a user with no devices", async () => {
    const userId = await seedUser({ role: "WAITER" });

    await notify(userId, "SHIFT_ASSIGNED", "Nova smena", "Sutra u 18h");

    expect(sendExpoPush).not.toHaveBeenCalled();
    const [row] = await dbRaw.notification.findMany({ where: { userId } });
    // Neither sent nor retried — there was nothing to send to, so the retry cron
    // must not pick this row up forever.
    expect(row.devicePushSent).toBe(false);
    expect(row.devicePushRetries).toBe(0);
  });
});
