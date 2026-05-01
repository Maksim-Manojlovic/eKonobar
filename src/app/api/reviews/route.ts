import { NextRequest, NextResponse } from "next/server";

// POST
export async function GET(req: NextRequest) {
  // TODO: implementiraj POST review sa geofencing provjerom
  return NextResponse.json({ ok: true });
}
