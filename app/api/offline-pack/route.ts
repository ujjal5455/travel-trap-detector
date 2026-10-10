import { connection } from "next/server";
import { getAreas, getBenchmarks, getPlaces } from "@/lib/server/reference-data";
import type { OfflinePack } from "@/lib/types";

/** Everything the browser needs to estimate a fare with no connection: areas, places, rate cards. */
export async function GET() {
  await connection(); // request time, so builds don't need the database
  try {
    const [areas, places, benchmarks] = await Promise.all([getAreas(), getPlaces(), getBenchmarks()]);
    const pack: OfflinePack = { version: 1, savedAt: new Date().toISOString(), areas, places, benchmarks };
    return Response.json(pack, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch (err) {
    console.error("GET /api/offline-pack failed:", err);
    return Response.json({ error: "Couldn't load offline data." }, { status: 503 });
  }
}
