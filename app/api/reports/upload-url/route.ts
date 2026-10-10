import { EVIDENCE_PHOTO } from "@/lib/config";
import { MemoryRateLimiter, rateLimitError, windowStart } from "@/lib/rate-limit";
import { readDeviceId } from "@/lib/server/device";
import { countReportsSince, createEvidenceUploadUrl } from "@/lib/server/repo";
import type { UploadUrlResponse } from "@/lib/types";

const limiter = new MemoryRateLimiter(EVIDENCE_PHOTO.uploadUrlsPerHour);

/**
 * Issues a one-time signed upload URL for a single new object in the private "evidence" bucket.
 * The path is chosen here ("<device>/<random>.jpg"); the browser can't pick or overwrite paths,
 * and nothing in that bucket can be read back.
 */
export async function POST(request: Request) {
  const deviceId = readDeviceId(request);
  if (!deviceId) return Response.json({ error: "Missing or invalid device ID. Reload the page and try again." }, { status: 400 });

  try {
    const limited = rateLimitError("report", await countReportsSince(deviceId, windowStart(new Date())));
    if (limited) return Response.json({ error: limited }, { status: 429, headers: { "Retry-After": "600" } });
    if (!limiter.hit(deviceId)) {
      return Response.json({ error: "Too many photo uploads. Please try again later." }, { status: 429 });
    }

    const path = `${deviceId}/${crypto.randomUUID()}.jpg`;
    const signedUrl = await createEvidenceUploadUrl(path);
    return Response.json({ path, signedUrl } satisfies UploadUrlResponse);
  } catch (err) {
    console.error("POST /api/reports/upload-url failed:", err);
    return Response.json({ error: "Photo upload isn't available right now. You can send the report without it." }, { status: 503 });
  }
}
