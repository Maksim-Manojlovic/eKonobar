import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { update: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { PATCH } from "../route";

const USER_ID = "user-1";

function mockSession(id = USER_ID, role = "VENUE_OWNER") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("PATCH /api/user/tour-complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.user.update).mockResolvedValue({ id: USER_ID } as never);
  });

  it("authenticated user marks tour complete → 200", async () => {
    const res = await PATCH();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await PATCH();
    expect(res.status).toBe(401);
  });

  it("sets tourCompleted: true for correct user", async () => {
    await PATCH();
    expect(vi.mocked(db.user.update)).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { tourCompleted: true },
    });
  });

  it("works for any role (WAITER)", async () => {
    mockSession(USER_ID, "WAITER");
    const res = await PATCH();
    expect(res.status).toBe(200);
  });
});
