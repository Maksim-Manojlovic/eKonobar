import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isExpoPushToken, sendExpoPush } from "../expo-push";

const OK = { status: "ok" as const };
const DEAD = { status: "error" as const, message: "not registered", details: { error: "DeviceNotRegistered" } };
const OTHER = { status: "error" as const, message: "rate limited", details: { error: "MessageRateExceeded" } };

function mockExpo(...responses: Array<{ data: unknown[] } | { httpStatus: number }>) {
  const fetchMock = vi.fn();
  for (const r of responses) {
    if ("httpStatus" in r) {
      fetchMock.mockResolvedValueOnce({ ok: false, status: r.httpStatus, statusText: "Bad Gateway" });
    } else {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => r });
    }
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.EXPO_ACCESS_TOKEN;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isExpoPushToken", () => {
  it.each([
    ["ExponentPushToken[abc123]", true],
    ["ExpoPushToken[abc123]",     true],   // legacy form
    ["ExponentPushToken[]",       false],
    ["fcm-raw-token",             false],
    ["",                          false],
    ["ExponentPushToken abc",     false],
  ])("%s → %s", (token, expected) => {
    expect(isExpoPushToken(token)).toBe(expected);
  });
});

describe("sendExpoPush", () => {
  it("makes no network call for an empty token list", async () => {
    const fetchMock = mockExpo();
    const out = await sendExpoPush([], { title: "T", body: "B" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(out).toEqual({ delivered: 0, invalidTokens: [] });
  });

  it("counts accepted tickets", async () => {
    mockExpo({ data: [OK, OK] });

    const out = await sendExpoPush(["ExponentPushToken[a]", "ExponentPushToken[b]"], { title: "T", body: "B" });
    expect(out.delivered).toBe(2);
    expect(out.invalidTokens).toEqual([]);
  });

  it("reports DeviceNotRegistered tokens for deletion, by position", async () => {
    mockExpo({ data: [OK, DEAD, OK] });

    const out = await sendExpoPush(
      ["ExponentPushToken[a]", "ExponentPushToken[b]", "ExponentPushToken[c]"],
      { title: "T", body: "B" },
    );

    expect(out.delivered).toBe(2);
    expect(out.invalidTokens).toEqual(["ExponentPushToken[b]"]);
  });

  it("does not mark a transient error as an invalid token", async () => {
    mockExpo({ data: [OTHER] });

    const out = await sendExpoPush(["ExponentPushToken[a]"], { title: "T", body: "B" });

    expect(out.delivered).toBe(0);
    expect(out.invalidTokens).toEqual([]);
  });

  it("splits into batches of 100 — Expo rejects more in one request", async () => {
    const tokens = Array.from({ length: 250 }, (_, i) => `ExponentPushToken[${i}]`);
    const fetchMock = mockExpo(
      { data: Array(100).fill(OK) },
      { data: Array(100).fill(OK) },
      { data: Array(50).fill(OK) },
    );

    const out = await sendExpoPush(tokens, { title: "T", body: "B" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toHaveLength(100);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toHaveLength(50);
    expect(out.delivered).toBe(250);
  });

  it("puts link in data so the app can deep-link, not in the visible body", async () => {
    const fetchMock = mockExpo({ data: [OK] });

    await sendExpoPush(["ExponentPushToken[a]"], { title: "T", body: "B", link: "/waiter/smene" });

    const [message] = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(message).toMatchObject({ to: "ExponentPushToken[a]", title: "T", body: "B" });
    expect(message.data).toEqual({ link: "/waiter/smene" });
  });

  it("omits the Authorization header when EXPO_ACCESS_TOKEN is unset", async () => {
    const fetchMock = mockExpo({ data: [OK] });

    await sendExpoPush(["ExponentPushToken[a]"], { title: "T", body: "B" });

    expect(fetchMock.mock.calls[0][1].headers.authorization).toBeUndefined();
  });

  it("sends the Authorization header when EXPO_ACCESS_TOKEN is set", async () => {
    process.env.EXPO_ACCESS_TOKEN = "secret-token";
    const fetchMock = mockExpo({ data: [OK] });

    await sendExpoPush(["ExponentPushToken[a]"], { title: "T", body: "B" });

    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer secret-token");
  });

  it("throws when the transport itself fails, so the caller can log and retry", async () => {
    mockExpo({ httpStatus: 502 });

    await expect(
      sendExpoPush(["ExponentPushToken[a]"], { title: "T", body: "B" }),
    ).rejects.toThrow(/502/);
  });
});
