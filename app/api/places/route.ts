import { cacheLife } from "next/cache";
import { connection } from "next/server";
import { listAreas, listPlaces } from "@/lib/server/repo";
import type { PlacesResponse } from "@/lib/types";

/** Preset places grouped by area. Cached for 1 hour on the server and in the browser. */
async function getPresetPlaces(): Promise<PlacesResponse> {
  "use cache";
  cacheLife("hours");

  const [areas, places] = await Promise.all([listAreas(), listPlaces()]);
  return {
    areas: areas.map(({ id, name, state }) => ({
      id,
      name,
      state,
      places: places
        .filter((p) => p.areaId === id)
        .map((p) => ({ id: p.id, name: p.name, kind: p.kind, lat: p.lat, lng: p.lng })),
    })),
  };
}

export async function GET() {
  // Render at request time, not at build, so builds don't depend on the database being reachable.
  await connection();
  try {
    return Response.json(await getPresetPlaces(), {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch (err) {
    console.error("GET /api/places failed:", err);
    return Response.json({ error: "Could not load places. Try again shortly." }, { status: 503 });
  }
}
