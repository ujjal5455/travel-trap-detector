import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Keep the dev badge clear of the bottom nav.
  devIndicators: { position: "top-right" },
  partialPrefetching: true,
  experimental: {
    // Tailwind CSS is small; inlining it removes a render-blocking request on slow connections.
    // Pages are cached by the service worker, so repeat visits don't re-download much.
    inlineCss: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// withSerwist keeps esbuild out of the server bundle; it builds the service worker at request/build time.
export default withSerwist(nextConfig);
