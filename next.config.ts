import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  serverExternalPackages: ["playwright", "playwright-core"],
  outputFileTracingIncludes: {
    "/api/github/pr-webhook": [
      "./node_modules/playwright/.local-browsers/**/*",
      "./node_modules/playwright-core/.local-browsers/**/*",
    ],
    "/api/reviews/run": [
      "./node_modules/playwright/.local-browsers/**/*",
      "./node_modules/playwright-core/.local-browsers/**/*",
    ],
    "/api/reviews/run/spaceguard": [
      "./node_modules/playwright/.local-browsers/**/*",
      "./node_modules/playwright-core/.local-browsers/**/*",
    ],
  },
};

export default nextConfig;
