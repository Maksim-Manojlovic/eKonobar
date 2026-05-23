import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";
import { withRole, withAuth } from "../with-role";

const CTX = { params: Promise.resolve({}) };

function mockSession(role = "WAITER", id = "u-1") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

function makeReq() {
  return new Request("http://localhost/api/test");
}

describe("withRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("correct single role -> calls handler", async () => {
    mockSession("ADMIN");
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const wrapped = withRole("ADMIN", handler);
    const res = await wrapped(makeReq(), CTX);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });

  it("correct role in array -> calls handler", async () => {
    mockSession("VENUE_OWNER");
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const wrapped = withRole(["VENUE_OWNER", "ADMIN"], handler);
    await wrapped(makeReq(), CTX);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("wrong role -> 403", async () => {
    mockSession("WAITER");
    const handler = vi.fn();
    const wrapped = withRole("ADMIN", handler);
    const res = await wrapped(makeReq(), CTX);
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("no session -> 401", async () => {
    mockNoSession();
    const handler = vi.fn();
    const wrapped = withRole("ADMIN", handler);
    const res = await wrapped(makeReq(), CTX);
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("handler receives session as third arg", async () => {
    mockSession("WAITER", "test-id");
    let capturedSession: unknown;
    const handler = vi.fn().mockImplementation((_req, _ctx, session) => {
      capturedSession = session;
      return new Response("ok");
    });
    const wrapped = withRole("WAITER", handler);
    await wrapped(makeReq(), CTX);
    expect((capturedSession as { user: { id: string } }).user.id).toBe("test-id");
  });
});

describe("withAuth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("any authenticated role -> calls handler", async () => {
    mockSession("HEADHUNTER");
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const wrapped = withAuth(handler);
    const res = await wrapped(makeReq(), CTX);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });

  it("no session -> 401", async () => {
    mockNoSession();
    const handler = vi.fn();
    const wrapped = withAuth(handler);
    const res = await wrapped(makeReq(), CTX);
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
});
