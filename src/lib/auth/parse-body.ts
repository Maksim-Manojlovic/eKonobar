import { type ZodSchema } from "zod";
import { NextResponse } from "next/server";

type ParseOk<T> = { ok: true; data: T };
type ParseFail = { ok: false; response: Response };
type ParseResult<T> = ParseOk<T> | ParseFail;

/**
 * Parses and validates a JSON request body against a Zod schema.
 * Returns a discriminated union — check `result.ok` before accessing `result.data`.
 *
 * Usage:
 *   const parsed = await parseBody(MySchema, req);
 *   if (!parsed.ok) return parsed.response;
 *   const { field } = parsed.data;   // fully typed
 */
export async function parseBody<T>(
  schema: ZodSchema<T>,
  req: Request,
): Promise<ParseResult<T>> {
  let raw: unknown;

  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    };
  }

  const result = schema.safeParse(raw);

  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: result.error.flatten() },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: result.data };
}

/**
 * Parses query params from a URL against a Zod schema.
 * Converts URLSearchParams to a plain object first.
 *
 * Usage:
 *   const parsed = parseQuery(MySchema, req);
 *   if (!parsed.ok) return parsed.response;
 */
export function parseQuery<T>(
  schema: ZodSchema<T>,
  req: Request,
): ParseResult<T> {
  const url = new URL(req.url);
  const raw = Object.fromEntries(url.searchParams.entries());

  const result = schema.safeParse(raw);

  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: result.error.flatten() },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: result.data };
}
