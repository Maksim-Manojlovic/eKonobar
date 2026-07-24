import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/auth/parse-body";
import { rateLimit } from "@/lib/core/rate-limit";
import { getClientIp } from "@/lib/core/ip";
import { sendDemoLeadEmail } from "@/lib/integrations/email";
import logger from "@/lib/core/logger";

// Public (see PUBLIC_API_PATTERNS). Lead capture for the /for-venues demo form.
const LeadSchema = z.object({
  venueName: z.string().trim().min(1).max(120),
  name:      z.string().trim().min(1).max(120),
  phone:     z.string().trim().min(4).max(30),
  venueType: z.string().trim().max(60).optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const allowed = await rateLimit(`lead:${ip}`, 5, 60 * 60 * 1000); // 5/hour per IP
  if (!allowed) {
    return NextResponse.json({ error: "Previše zahteva. Pokušaj kasnije." }, { status: 429 });
  }

  const parsed = await parseBody(LeadSchema, req);
  if (!parsed.ok) return parsed.response;

  const lead = parsed.data;

  // Durable record: structured log (captured in prod JSON logs) …
  logger.info({ lead, ip }, "demo lead captured");
  // … plus best-effort ops email (no-op without SMTP). Never fail the request on send error.
  sendDemoLeadEmail(lead).catch((err) => logger.warn({ err }, "demo lead email failed"));

  return NextResponse.json({ ok: true });
}
