import { NextRequest, NextResponse } from "next/server";

// GET | POST | PUT | DELETE
export async function GET(req: NextRequest) {
  // TODO: implementiraj CRUD zone na mapi
  return NextResponse.json({ ok: true });
}
