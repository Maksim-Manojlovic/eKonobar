import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-role";
import cloudinary from "@/lib/integrations/cloudinary";
import logger from "@/lib/core/logger";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const UPLOAD_CONFIGS = {
  avatar: {
    folder: "ekonobar/avatars",
    width: 400, height: 400, crop: "fill" as const, gravity: "face" as const,
    quality: "auto" as const, format: "webp" as const,
  },
  "venue-photo": {
    folder: "ekonobar/venues",
    width: 1200, height: 800, crop: "fill" as const,
    quality: "auto" as const, format: "webp" as const,
  },
  "sanitary-doc": {
    folder:        "ekonobar/sanitary",
    resource_type: "auto" as const, // handles PDF + image
  },
  // Doznaka / doctor's note attached to a SICK leave request.
  "leave-doc": {
    folder:        "ekonobar/leave",
    resource_type: "auto" as const,
  },
};

/**
 * Types that accept a PDF as well as an image. Both are scans of paperwork —
 * a sanitary book or a doznaka — which people photograph or receive as a PDF.
 */
const DOCUMENT_TYPES = new Set(["sanitary-doc", "leave-doc"]);

// MIME types that must never be accepted even though some start with "image/".
// SVG can embed <script> tags and executes JavaScript when opened in a browser.
const BLOCKED_MIME = new Set([
  "image/svg+xml",
  "image/svg",
  "text/html",
  "text/xml",
  "application/xml",
  "application/xhtml+xml",
]);

/**
 * Server-side magic-byte check for SVG regardless of the declared MIME type.
 * Catches files where the client sends image/jpeg but the content is actually SVG.
 */
function hasSvgSignature(buf: Buffer): boolean {
  // SVG always starts (possibly after a BOM or whitespace) with "<svg" or "<?xml"
  // followed eventually by "<svg", or "<!DOCTYPE svg".
  const head = buf.slice(0, 512).toString("utf8").replace(/\s+/g, " ").toLowerCase();
  return head.includes("<svg") || head.includes("<!doctype svg");
}

export const POST = withAuth(async (req) => {
  const formData = await req.formData();
  const file = formData.get("file");
  const type = (formData.get("type") as string) ?? "avatar";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fajl nije pronađen" }, { status: 400 });
  }

  // 1. Explicit MIME blocklist — rejects SVG and XML variants regardless of startsWith check.
  if (BLOCKED_MIME.has(file.type.toLowerCase())) {
    return NextResponse.json({ error: "Ovaj format fajla nije dozvoljen" }, { status: 400 });
  }

  // 2. MIME category allowlist.
  const isDocument  = DOCUMENT_TYPES.has(type);
  const allowedMime = isDocument
    ? file.type.startsWith("image/") || file.type === "application/pdf"
    : file.type.startsWith("image/");
  if (!allowedMime) {
    return NextResponse.json(
      { error: isDocument ? "Dozvoljeni su slike i PDF fajlovi" : "Dozvoljen je samo format slike" },
      { status: 400 },
    );
  }

  // 3. Size check before reading into memory.
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Maksimalna veličina fajla je 5MB" }, { status: 400 });
  }

  const bytes  = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // 4. Magic-byte SVG check — catches mislabeled files (e.g. Content-Type: image/jpeg, body: SVG).
  if (hasSvgSignature(buffer)) {
    return NextResponse.json({ error: "SVG fajlovi nisu dozvoljeni" }, { status: 400 });
  }

  const config  = UPLOAD_CONFIGS[type as keyof typeof UPLOAD_CONFIGS] ?? UPLOAD_CONFIGS.avatar;
  const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

  try {
    const result = await cloudinary.uploader.upload(dataUri, {
      ...config,
      overwrite: false,
    });

    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    logger.error({ err, type, fileName: file.name }, "POST /api/upload");
    return NextResponse.json({ error: "Upload nije uspeo" }, { status: 500 });
  }
});
