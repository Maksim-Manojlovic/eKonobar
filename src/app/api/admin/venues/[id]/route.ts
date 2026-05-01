import { NextRequest, NextResponse } from "next/server";

// DELETE
export async function GET(req: NextRequest) {
  // TODO: implementiraj hard-delete lokala (GDPR)
  return NextResponse.json({ ok: true });
}
