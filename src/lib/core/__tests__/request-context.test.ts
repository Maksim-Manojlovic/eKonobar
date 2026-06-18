import { describe, it, expect } from "vitest";
import {
  getRequestContext,
  runWithRequestContext,
  REQUEST_ID_HEADER,
  type RequestContext,
} from "../request-context";

const ctx: RequestContext = {
  traceId: "trace-123",
  userId: "u-1",
  route: "/api/test",
  method: "POST",
};

describe("request-context", () => {
  it("returns undefined outside a scope", () => {
    expect(getRequestContext()).toBeUndefined();
  });

  it("exposes the active context inside runWithRequestContext", () => {
    runWithRequestContext(ctx, () => {
      expect(getRequestContext()).toEqual(ctx);
    });
  });

  it("propagates context through async boundaries", async () => {
    await runWithRequestContext(ctx, async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
      expect(getRequestContext()?.traceId).toBe("trace-123");
    });
  });

  it("clears context after the scope exits", async () => {
    await runWithRequestContext(ctx, async () => undefined);
    expect(getRequestContext()).toBeUndefined();
  });

  it("isolates concurrent scopes", async () => {
    const seen: string[] = [];
    await Promise.all([
      runWithRequestContext({ ...ctx, traceId: "A" }, async () => {
        await new Promise((r) => setTimeout(r, 5));
        seen.push(getRequestContext()!.traceId);
      }),
      runWithRequestContext({ ...ctx, traceId: "B" }, async () => {
        seen.push(getRequestContext()!.traceId);
      }),
    ]);
    expect(seen.sort()).toEqual(["A", "B"]);
  });

  it("exports the correlation header name", () => {
    expect(REQUEST_ID_HEADER).toBe("x-request-id");
  });
});
