// Builds and serves the service worker (/serwist/sw.js) with Serwist's Turbopack integration.
// Next 16 with Cache Components removes the `dynamic`, `dynamicParams` and `revalidate` segment
// options, so only GET and generateStaticParams are re-exported from createSerwistRoute.
import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

// Versions the precached pages; a new commit means fresh pages after deploy.
const revision = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() || crypto.randomUUID();

const route = createSerwistRoute({
  // The app shell: every page is static, so precache them all plus the offline fallback.
  additionalPrecacheEntries: ["/", "/report", "/map", "/about", "/~offline"].map((url) => ({ url, revision })),
  swSrc: "app/sw.ts",
  useNativeEsbuild: true,
});

export const { GET, generateStaticParams } = route;
