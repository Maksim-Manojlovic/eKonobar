import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["cloudinary"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.mapbox.com" },
      { protocol: "https", hostname: "**.cloudinary.com" },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

export default nextConfig;
