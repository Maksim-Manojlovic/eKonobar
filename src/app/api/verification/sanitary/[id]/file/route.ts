import { NextResponse } from "next/server";
import { withRole } from "@/lib/with-role";
import { dbRaw } from "@/lib/db";
import { signCloudinaryUrl } from "@/lib/cloudinary";

export const GET = withRole<{ params: Promise<{ id: string }> }>("ADMIN", async (_req, ctx) => {
  const { id } = await ctx.params;
  const book = await dbRaw.sanitaryBook.findUnique({ where: { id }, select: { fileUrl: true } });
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const signedUrl = signCloudinaryUrl(book.fileUrl, 3600);
  return NextResponse.redirect(signedUrl, { status: 302 });
});
