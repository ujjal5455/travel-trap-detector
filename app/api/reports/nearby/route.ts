import type { NextRequest } from "next/server";
import { REPORTS } from "@/lib/config";
import { boundingBox } from "@/lib/geo";
import { toNearbyReports } from "@/lib/nearby";
import { readDeviceId } from "@/lib/server/device";
import { listReportsInBox, listVotes } from "@/lib/server/repo";
import type { NearbyReportsResponse } from "@/lib/types";
import { firstIssue, nearbyQuerySchema } from "@/lib/validation";

const DAY_MS = 86_400_000;

/** Recent reports within 1 km of a point, newest first. No device IDs, no photos. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = nearbyQuerySchema.safeParse({ lat: params.get("lat"), lng: params.get("lng") });
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const origin = parsed.data;

  try {
    const since = new Date(Date.now() - REPORTS.nearbyWindowDays * DAY_MS);
    // Over-fetch from the box (its corners lie outside the circle), then filter exactly.
    const rows = await listReportsInBox(boundingBox(origin, REPORTS.nearbyRadiusKm), since, REPORTS.nearbyLimit * 4);
    const votes = await listVotes(rows.map((r) => r.id));
    const reports = toNearbyReports(rows, votes, origin, readDeviceId(request), REPORTS.nearbyRadiusKm, REPORTS.nearbyLimit);
    return Response.json({ reports } satisfies NearbyReportsResponse, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/reports/nearby failed:", err);
    return Response.json({ error: "Couldn't load nearby reports right now." }, { status: 503 });
  }
}
