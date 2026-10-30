import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.ALL_ITEMS_NEXT_DIST || ".next",
  devIndicators: false,
  images: { localPatterns: [{ pathname: "/media/**" }] },
  experimental: { serverActions: { bodySizeLimit: "22mb" } },
};

export default nextConfig;
