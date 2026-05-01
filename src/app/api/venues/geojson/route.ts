import { NextRequest, NextResponse } from "next/server";

// GET
export async function GET(req: NextRequest) {
  // TODO: implementiraj venues GeoJSON bounding-box
  return NextResponse.json({ ok: true });
}
