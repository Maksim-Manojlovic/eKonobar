import { NextRequest, NextResponse } from "next/server";

// POST
export async function GET(req: NextRequest) {
  // TODO: implementiraj upload sanitarne knjižice
  return NextResponse.json({ ok: true });
}
