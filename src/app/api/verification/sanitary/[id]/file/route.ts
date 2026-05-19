import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbRaw } from "@/lib/db";
import { signCloudinaryUrl } from "@/lib/cloudinary";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const book = await dbRaw.sanitaryBook.findUnique({ where: { id }, select: { fileUrl: true } });
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const signedUrl = signCloudinaryUrl(book.fileUrl, 3600);
  return NextResponse.redirect(signedUrl, { status: 302 });
}
