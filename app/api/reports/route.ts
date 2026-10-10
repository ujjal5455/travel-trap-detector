import { getDistance } from "@/lib/distance";
import { nearestArea } from "@/lib/geo";
import { rateLimitError, windowStart } from "@/lib/rate-limit";
import { redactPersonalDetails } from "@/lib/redact";
import { readDeviceId } from "@/lib/server/device";
import { getAreas } from "@/lib/server/reference-data";
import { countReportsSince, evidenceExists, insertReport } from "@/lib/server/repo";
import type { CreateReportResponse } from "@/lib/types";
import { firstIssue, reportRequestSchema } from "@/lib/validation";

const error = (status: number, message: string, headers?: HeadersInit) =>
  Response.json({ error: message }, { status, headers });

export async function POST(request: Request) {
  const deviceId = readDeviceId(request);
  if (!deviceId) return error(400, "Missing or invalid device ID. Reload the page and try again.");

  const json: unknown = await request.json().catch(() => null);
  if (json === null || typeof json !== "object") return error(400, "The request body must be a JSON object.");
  const parsed = reportRequestSchema.safeParse(json);
  if (!parsed.success) return error(400, firstIssue(parsed.error));
  const body = parsed.data;

  try {
    const limited = rateLimitError("report", await countReportsSince(deviceId, windowStart(new Date())));
    if (limited) return error(429, limited, { "Retry-After": "600" });

    // The photo must be one this device uploaded through its own signed URL.
    if (body.photoPath) {
      if (!body.photoPath.startsWith(`${deviceId}/`)) return error(400, "That photo belongs to another upload.");
      if (!(await evidenceExists(body.photoPath))) return error(400, "The photo upload didn't finish. Try attaching it again.");
    }

    const isGuide = body.serviceType === "guide";
    const [areas, distance] = await Promise.all([
      getAreas(),
      isGuide || !body.drop
        ? Promise.resolve(null)
        : getDistance(body.pickup, body.drop, {
            apiKey: process.env.ORS_API_KEY?.trim() || undefined,
            onFallback: (reason) => console.warn(`Distance fallback to estimate: ${reason}`),
          }),
    ]);

    const description = body.description ? redactPersonalDetails(body.description) : null;
    const id = await insertReport({
      deviceId,
      areaId: nearestArea(body.pickup, areas)?.id ?? null,
      serviceType: body.serviceType,
      pickupLat: body.pickup.lat,
      pickupLng: body.pickup.lng,
      dropLat: isGuide ? null : (body.drop?.lat ?? null),
      dropLng: isGuide ? null : (body.drop?.lng ?? null),
      // The schema needs a positive distance for trips; a same-point trip gets the smallest step.
      distanceKm: distance ? Math.max(distance.distanceKm, 0.1) : null,
      sessionType: isGuide ? (body.sessionType ?? null) : null,
      quotedPrice: body.quotedPrice ?? null,
      paidPrice: body.paidPrice ?? null,
      feltFair: body.feltFair ?? null,
      isScam: body.isScam,
      scamTags: body.isScam ? body.scamTags : [],
      description: description?.text || null,
      photoPath: body.photoPath ?? null,
    });

    return Response.json({ id, redacted: description?.redacted ?? false } satisfies CreateReportResponse, { status: 201 });
  } catch (err) {
    console.error("POST /api/reports failed:", err);
    return error(503, "Something went wrong on our side. Please try again in a moment.");
  }
}
