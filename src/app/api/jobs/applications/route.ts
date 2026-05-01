import { NextRequest, NextResponse } from "next/server";

// GET | POST
export async function GET(req: NextRequest) {
  // TODO: implementiraj prijave na oglase
  return NextResponse.json({ ok: true });
}
