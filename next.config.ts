import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: { localPatterns: [{ pathname: "/media/**" }] },
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
};

export default nextConfig;
