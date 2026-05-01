import { NextRequest, NextResponse } from "next/server";

// POST
export async function GET(req: NextRequest) {
  // TODO: implementiraj generisanje pozivnica za verifikaciju
  return NextResponse.json({ ok: true });
}
