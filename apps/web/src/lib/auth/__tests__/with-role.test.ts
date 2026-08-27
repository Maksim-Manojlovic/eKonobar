import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { withRole, withAuth } from "../with-role";
import { getRequestContext, REQUEST_ID_HEADER } from "@/lib/core/request-context";

const CTX = { params: Promise.resolve({}) };

function mockSession(role = "WAITER", id = "u-1") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

function makeReq(headers?: Record<string, string>) {
  return new NextRequest("http://localhost/api/test", headers ? { headers } : undefined);
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

describe("trace propagation (TEL-B/TEL-C)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("echoes the incoming x-request-id on the response", async () => {
    mockSession("ADMIN");
    const wrapped = withRole("ADMIN", async () => new Response("ok"));
    const res = await wrapped(makeReq({ [REQUEST_ID_HEADER]: "trace-abc" }), CTX);
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe("trace-abc");
  });

  it("generates a fallback trace id when the header is absent", async () => {
    mockSession("ADMIN");
    const wrapped = withRole("ADMIN", async () => new Response("ok"));
    const res = await wrapped(makeReq(), CTX);
    const id = res.headers.get(REQUEST_ID_HEADER);
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("binds traceId/userId/route/method into the request context the handler runs in", async () => {
    mockSession("WAITER", "waiter-9");
    let seen: ReturnType<typeof getRequestContext>;
    const wrapped = withRole("WAITER", async () => {
      seen = getRequestContext();
      return new Response("ok");
    });
    await wrapped(makeReq({ [REQUEST_ID_HEADER]: "trace-xyz" }), CTX);
    expect(seen).toEqual({
      traceId: "trace-xyz",
      userId: "waiter-9",
      route: "/api/test",
      method: "GET",
    });
  });

  it("echoes the trace id even on a 403", async () => {
    mockSession("WAITER");
    const wrapped = withRole("ADMIN", async () => new Response("ok"));
    const res = await wrapped(makeReq({ [REQUEST_ID_HEADER]: "trace-403" }), CTX);
    expect(res.status).toBe(403);
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe("trace-403");
  });

  it("echoes the trace id even on a 401", async () => {
    mockNoSession();
    const wrapped = withAuth(async () => new Response("ok"));
    const res = await wrapped(makeReq({ [REQUEST_ID_HEADER]: "trace-401" }), CTX);
    expect(res.status).toBe(401);
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe("trace-401");
  });

  it("leaves no request context after the wrapper returns", async () => {
    mockSession("ADMIN");
    const wrapped = withRole("ADMIN", async () => new Response("ok"));
    await wrapped(makeReq(), CTX);
    expect(getRequestContext()).toBeUndefined();
  });
});
