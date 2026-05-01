import { NextRequest, NextResponse } from "next/server";

// GET
export async function GET(req: NextRequest) {
  // TODO: implementiraj jobs markeri za mapu sa Red Alert filterom
  return NextResponse.json({ ok: true });
}
