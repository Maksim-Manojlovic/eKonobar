import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted, not a plain const: vi.mock is lifted above every top-level
// statement, so a factory closing over an ordinary const throws
// "Cannot access 'mockDb' before initialization".
const mockDb = vi.hoisted(() => ({
  mobileRefreshToken: {
    create:     vi.fn(),
    findUnique: vi.fn(),
    update:     vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/core/db",    () => ({ db: mockDb, dbRaw: mockDb }));
vi.mock("@/lib/core/redis", () => ({ redis: null }));

import {
  hashRefreshToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeDeviceChain,
  REFRESH_TTL_MS,
} from "../mobile-tokens";

const DEVICE = { deviceId: "device-1", deviceName: "iPhone 13", platform: "ios" };

function row(overrides: Record<string, unknown> = {}) {
  return {
    id:         "row-1",
    userId:     "user-1",
    deviceId:   "device-1",
    deviceName: "iPhone 13",
    platform:   "ios",
    expiresAt:  new Date(Date.now() + REFRESH_TTL_MS),
    revokedAt:  null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.$transaction.mockResolvedValue([]);
});

describe("hashRefreshToken", () => {
  it("is deterministic", () => {
    expect(hashRefreshToken("abc")).toBe(hashRefreshToken("abc"));
  });

  it("differs for different inputs", () => {
    expect(hashRefreshToken("abc")).not.toBe(hashRefreshToken("abd"));
  });

  it("returns a 64-char sha256 hex digest", () => {
    expect(hashRefreshToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("issueRefreshToken", () => {
  it("stores only the hash, never the raw token", async () => {
    const { token } = await issueRefreshToken("user-1", DEVICE);

    const written = mockDb.mobileRefreshToken.create.mock.calls[0][0].data;
    expect(written.tokenHash).toBe(hashRefreshToken(token));
    expect(JSON.stringify(written)).not.toContain(token);
  });

  it("returns an expiry REFRESH_TTL_MS in the future", async () => {
    const { expiresAt } = await issueRefreshToken("user-1", DEVICE);
    const delta = expiresAt.getTime() - Date.now();

    expect(delta).toBeGreaterThan(REFRESH_TTL_MS - 5_000);
    expect(delta).toBeLessThanOrEqual(REFRESH_TTL_MS);
  });

  it("issues a different token every call", async () => {
    const a = await issueRefreshToken("user-1", DEVICE);
    const b = await issueRefreshToken("user-1", DEVICE);
    expect(a.token).not.toBe(b.token);
  });
});

describe("rotateRefreshToken", () => {
  it("rejects an unknown token", async () => {
    mockDb.mobileRefreshToken.findUnique.mockResolvedValue(null);

    expect(await rotateRefreshToken("nope")).toEqual({ ok: false, reason: "unknown" });
  });

  it("rejects an expired token without rotating", async () => {
    mockDb.mobileRefreshToken.findUnique.mockResolvedValue(
      row({ expiresAt: new Date(Date.now() - 1000) }),
    );

    expect(await rotateRefreshToken("old")).toEqual({ ok: false, reason: "expired" });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("issues a successor and revokes the presented token in one transaction", async () => {
    mockDb.mobileRefreshToken.findUnique.mockResolvedValue(row());

    const result = await rotateRefreshToken("current");

    expect(result.ok).toBe(true);
    // Both writes go through a single $transaction call — a crash between them
    // would otherwise leave two live tokens and defeat reuse detection.
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.$transaction.mock.calls[0][0]).toHaveLength(2);
  });

  it("carries the device identity onto the successor", async () => {
    mockDb.mobileRefreshToken.findUnique.mockResolvedValue(row());

    await rotateRefreshToken("current");

    const created = mockDb.mobileRefreshToken.create.mock.calls[0][0].data;
    expect(created).toMatchObject({
      userId: "user-1", deviceId: "device-1", deviceName: "iPhone 13", platform: "ios",
    });
  });

  it("treats a already-revoked token as theft and kills the device chain", async () => {
    mockDb.mobileRefreshToken.findUnique.mockResolvedValue(row({ revokedAt: new Date() }));

    expect(await rotateRefreshToken("replayed")).toEqual({ ok: false, reason: "reused" });
    expect(mockDb.mobileRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", deviceId: "device-1", revokedAt: null },
      data:  { revokedAt: expect.any(Date) },
    });
  });
});

describe("revocation", () => {
  it("revokeRefreshToken targets the hash, not the raw value", async () => {
    await revokeRefreshToken("raw-token");

    expect(mockDb.mobileRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: hashRefreshToken("raw-token"), revokedAt: null },
      data:  { revokedAt: expect.any(Date) },
    });
  });

  it("revokeDeviceChain only touches live tokens for that install", async () => {
    await revokeDeviceChain("user-9", "device-9");

    expect(mockDb.mobileRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-9", deviceId: "device-9", revokedAt: null },
      data:  { revokedAt: expect.any(Date) },
    });
  });
});
