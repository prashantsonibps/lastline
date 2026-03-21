import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  serverExternalPackages: ["@sparticuz/chromium", "ffmpeg-static", "playwright", "playwright-core"],
  outputFileTracingIncludes: {
    "/api/github/pr-webhook": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
      "./node_modules/ffmpeg-static/**/*",
    ],
    "/api/reviews/run": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
      "./node_modules/ffmpeg-static/**/*",
    ],
    "/api/reviews/run/spaceguard": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
      "./node_modules/ffmpeg-static/**/*",
    ],
    "/api/reviews/[jobId]/artifacts/screenshot": [
      "./node_modules/ffmpeg-static/**/*",
    ],
  },
};

export default nextConfig;
