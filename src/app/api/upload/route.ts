import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import cloudinary from "@/lib/cloudinary";

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
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const type = (formData.get("type") as string) ?? "avatar";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fajl nije pronađen" }, { status: 400 });
  }
  const isSanitaryDoc = type === "sanitary-doc";
  const allowedMime   = isSanitaryDoc
    ? file.type.startsWith("image/") || file.type === "application/pdf"
    : file.type.startsWith("image/");
  if (!allowedMime) {
    return NextResponse.json(
      { error: isSanitaryDoc ? "Dozvoljeni su slike i PDF fajlovi" : "Dozvoljen je samo format slike" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Maksimalna veličina fajla je 5MB" }, { status: 400 });
  }

  const config = UPLOAD_CONFIGS[type as keyof typeof UPLOAD_CONFIGS] ?? UPLOAD_CONFIGS.avatar;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

  try {
    const result = await cloudinary.uploader.upload(dataUri, {
      ...config,
      overwrite: false,
    });

    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    console.error("[POST /api/upload]", err);
    return NextResponse.json({ error: "Upload nije uspeo" }, { status: 500 });
  }
}
