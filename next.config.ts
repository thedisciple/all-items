import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.ALL_ITEMS_NEXT_DIST || ".next",
  devIndicators: false,
  // Locale metadata is cheap; keep title/icons in the initial head during hydration.
  htmlLimitedBots: /.*/,
  images: { localPatterns: [{ pathname: "/media/**" }] },
  experimental: { serverActions: { bodySizeLimit: "22mb" } },
};

export default nextConfig;
