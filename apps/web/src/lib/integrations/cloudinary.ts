import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;

// Generate a signed Cloudinary URL that expires after ttlSeconds (default 1 hour).
// Works for both image and raw (PDF) resources. Falls back to the original URL
// if it can't be parsed as a Cloudinary URL (e.g. legacy external links).
export function signCloudinaryUrl(url: string, ttlSeconds = 3600): string {
  const match = url.match(/\/(?:image|raw|video)\/upload\/(?:v\d+\/)?(.+)$/);
  if (!match) return url;
  const publicId    = match[1];
  const resourceType: "image" | "raw" | "video" = url.includes("/raw/upload/")
    ? "raw"
    : url.includes("/video/upload/")
    ? "video"
    : "image";
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    sign_url:      true,
    expires_at:    Math.floor(Date.now() / 1000) + ttlSeconds,
    secure:        true,
  });
}
