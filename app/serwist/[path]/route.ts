// Builds and serves the service worker (/serwist/sw.js) with Serwist's Turbopack integration.
//
// Two adjustments for Next 16 with Cache Components:
// - `dynamic`, `dynamicParams` and `revalidate` no longer exist, so they aren't re-exported.
// - The file is built inside a "use cache" function so it is prerendered at build time. On Vercel
//   it is then served as a static file, instead of running esbuild inside a serverless function
//   (where esbuild and the source files aren't available).
import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";
import { cacheLife } from "next/cache";

// Versions the precached pages: Vercel provides the commit, locally ask git, else a random id.
const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

const serwist = createSerwistRoute({
  // The app shell: every page is static, so precache them all plus the offline fallback.
  additionalPrecacheEntries: ["/", "/report", "/map", "/about", "/~offline"].map((url) => ({ url, revision })),
  swSrc: "app/sw.ts",
  useNativeEsbuild: true,
});

export const generateStaticParams = serwist.generateStaticParams;

async function buildFile(path: string): Promise<{ body: string; contentType: string }> {
  "use cache";
  cacheLife("max");
  const res = await serwist.GET(new Request(`http://build.local/serwist/${path}`) as never, {
    params: Promise.resolve({ path }),
  });
  return { body: await res.text(), contentType: res.headers.get("Content-Type") ?? "text/javascript" };
}

export async function GET(_request: Request, { params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  const file = await buildFile(path);
  return new Response(file.body, {
    headers: { "Content-Type": file.contentType, "Service-Worker-Allowed": "/" },
  });
}
