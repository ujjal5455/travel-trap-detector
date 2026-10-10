import { COMMUNITY_BLEND, COMMUNITY_ESCALATION } from "@/lib/config";
import { getDistance } from "@/lib/distance";
import { templateExplanation } from "@/lib/explain";
import { boundingBox, nearestArea } from "@/lib/geo";
import { rateLimitError, windowStart } from "@/lib/rate-limit";
import { scoreFare, ScoringInputError, selectBenchmark } from "@/lib/scoring";
import { readDeviceId } from "@/lib/server/device";
import { getAreas, getBenchmarks } from "@/lib/server/reference-data";
import {
  countFareChecksSince,
  insertFareCheck,
  listCommunityCandidates,
  listScamCandidates,
} from "@/lib/server/repo";
import type { CheckResponse } from "@/lib/types";
import { checkRequestSchema, firstIssue } from "@/lib/validation";

const DAY_MS = 86_400_000;
const error = (status: number, message: string, headers?: HeadersInit) =>
  Response.json({ error: message }, { status, headers });

export async function POST(request: Request) {
  const deviceId = readDeviceId(request);
  if (!deviceId) return error(400, "Missing or invalid device ID. Reload the page and try again.");

  const json: unknown = await request.json().catch(() => null);
  if (json === null || typeof json !== "object") return error(400, "The request body must be a JSON object.");
  const parsed = checkRequestSchema.safeParse(json);
  if (!parsed.success) return error(400, firstIssue(parsed.error));
  const body = parsed.data;

  try {
    const now = new Date();
    const recent = await countFareChecksSince(deviceId, windowStart(now));
    const limited = rateLimitError("fareCheck", recent);
    if (limited) return error(429, limited, { "Retry-After": "600" });

    const isGuide = body.serviceType === "guide";
    const [areas, benchmarks, distance] = await Promise.all([
      getAreas(),
      getBenchmarks(),
      isGuide || !body.drop
        ? Promise.resolve(null)
        : getDistance(body.pickup, body.drop, {
            apiKey: process.env.ORS_API_KEY?.trim() || undefined,
            onFallback: (reason) => console.warn(`Distance fallback to estimate: ${reason}`),
          }),
    ]);

    const area = nearestArea(body.pickup, areas);
    const benchmark = selectBenchmark(benchmarks, area?.id ?? null, body.serviceType);
    const [communityReports, scamReports] = await Promise.all([
      area
        ? listCommunityCandidates(area.id, body.serviceType, new Date(now.getTime() - COMMUNITY_BLEND.windowDays * DAY_MS))
        : Promise.resolve([]),
      listScamCandidates(
        boundingBox(body.pickup, COMMUNITY_ESCALATION.radiusMeters / 1000),
        new Date(now.getTime() - COMMUNITY_ESCALATION.windowDays * DAY_MS),
      ),
    ]);

    const tripTime = body.tripTime ? new Date(body.tripTime) : now;
    const verdict = scoreFare({
      serviceType: body.serviceType,
      quotedPrice: body.quotedPrice,
      areaId: area?.id ?? null,
      pickup: body.pickup,
      distanceKm: distance?.distanceKm ?? null,
      distanceMethod: distance?.method ?? null,
      sessionType: isGuide ? (body.sessionType ?? null) : null,
      tripTime,
      now,
      benchmark,
      communityReports,
      scamReports,
    });

    // Logging feeds the rate limit and later analysis, but a logging failure shouldn't hide the verdict.
    const checkId = await insertFareCheck({
      deviceId,
      areaId: area?.id ?? null,
      serviceType: body.serviceType,
      quotedPrice: body.quotedPrice,
      verdict,
    }).catch((err: unknown) => {
      console.error("fare_checks insert failed:", err);
      return null;
    });

    const response: CheckResponse = {
      checkId,
      verdict,
      explanation: templateExplanation(verdict, body.quotedPrice),
      area: area ? { id: area.id, name: area.name } : null,
      serviceType: body.serviceType,
      sessionType: isGuide ? (body.sessionType ?? null) : null,
      quotedPrice: body.quotedPrice,
      tripTime: tripTime.toISOString(),
    };
    return Response.json(response);
  } catch (err) {
    if (err instanceof ScoringInputError) return error(422, err.message);
    console.error("POST /api/check failed:", err);
    return error(503, "Something went wrong on our side. Please try again in a moment.");
  }
}
