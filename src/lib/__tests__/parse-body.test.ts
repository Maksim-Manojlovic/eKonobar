import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseBody, parseQuery } from "../parse-body";

const Schema = z.object({
  name: z.string().min(1),
  count: z.number().int().positive(),
});

function makeReq(body: unknown) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/test");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

describe("parseBody", () => {
  it("valid body -> ok:true with typed data", async () => {
    const result = await parseBody(Schema, makeReq({ name: "Test", count: 5 }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("Test");
      expect(result.data.count).toBe(5);
    }
  });

  it("missing required field -> ok:false with 400 response", async () => {
    const result = await parseBody(Schema, makeReq({ name: "Test" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it("wrong type -> ok:false with 400", async () => {
    const result = await parseBody(Schema, makeReq({ name: "Test", count: "not-a-number" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it("invalid JSON -> ok:false with 400", async () => {
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not valid json",
    });
    const result = await parseBody(Schema, req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it("empty object -> fails required fields", async () => {
    const result = await parseBody(Schema, makeReq({}));
    expect(result.ok).toBe(false);
  });
});

describe("parseQuery", () => {
  const QuerySchema = z.object({
    page: z.coerce.number().default(1),
    search: z.string().optional(),
  });

  it("valid params -> ok:true", () => {
    const result = parseQuery(QuerySchema, makeGetReq({ page: "3", search: "test" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.page).toBe(3);
      expect(result.data.search).toBe("test");
    }
  });

  it("coerces string to number", () => {
    const result = parseQuery(QuerySchema, makeGetReq({ page: "5" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.page).toBe(5);
  });

  it("uses default when param missing", () => {
    const result = parseQuery(QuerySchema, makeGetReq());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.page).toBe(1);
  });

  it("invalid coercion -> ok:false with 400", () => {
    const StrictSchema = z.object({ count: z.coerce.number().int() });
    const result = parseQuery(StrictSchema, makeGetReq({ count: "abc" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });
});
