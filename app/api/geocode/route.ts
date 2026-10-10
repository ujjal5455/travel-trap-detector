import type { NextRequest } from "next/server";
import { nominatim } from "@/lib/nominatim";
import type { GeocodeResponse } from "@/lib/types";
import { firstIssue, geocodeQuerySchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const parsed = geocodeQuerySchema.safeParse({ q: request.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  try {
    const results = await nominatim.search(parsed.data.q);
    return Response.json({ results } satisfies GeocodeResponse, {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  } catch (err) {
    console.warn("GET /api/geocode failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Place search is unavailable right now. Pick a popular place or tap the map." }, { status: 502 });
  }
}
