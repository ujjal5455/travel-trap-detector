import { cacheLife } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { COMMUNITY_ESCALATION } from "@/lib/config";
import { findHotspots } from "@/lib/hotspots";
import { getAreas, getBenchmarks, getPlaces } from "@/lib/server/reference-data";
import { listScamPoints } from "@/lib/server/repo";
import { SERVICE_TYPES, type HotspotsResponse, type ServiceType } from "@/lib/types";
import { firstIssue } from "@/lib/validation";

const DAY_MS = 86_400_000;
const querySchema = z.object({ service_type: z.enum(SERVICE_TYPES).optional() });

/** Cached for about a minute per service filter; new reports show up on the next refresh. */
async function computeHotspots(serviceType: ServiceType | null): Promise<HotspotsResponse> {
  "use cache";
  cacheLife("minutes");

  const now = new Date();
  const since = new Date(now.getTime() - COMMUNITY_ESCALATION.windowDays * DAY_MS);
  const [points, benchmarks, places, areas] = await Promise.all([
    listScamPoints(since, serviceType ?? undefined),
    getBenchmarks(),
    getPlaces(),
    getAreas(),
  ]);
  return {
    hotspots: findHotspots(points, { now, serviceType: serviceType ?? undefined, benchmarks, places, areas }),
    serviceType,
    windowDays: COMMUNITY_ESCALATION.windowDays,
    minDevices: COMMUNITY_ESCALATION.minDistinctDevices,
  };
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("service_type");
  const parsed = querySchema.safeParse({ service_type: raw || undefined });
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });

  try {
    return Response.json(await computeHotspots(parsed.data.service_type ?? null), {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (err) {
    console.error("GET /api/hotspots failed:", err);
    return Response.json({ error: "Couldn't load hotspots right now." }, { status: 503 });
  }
}
