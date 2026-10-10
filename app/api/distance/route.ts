import { getDistance } from "@/lib/distance";
import type { DistanceResponse } from "@/lib/types";
import { distanceRequestSchema, firstIssue } from "@/lib/validation";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = distanceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const { from, to } = parsed.data;
  const result: DistanceResponse = await getDistance(from, to, {
    apiKey: process.env.ORS_API_KEY?.trim() || undefined,
    onFallback: (reason) => console.warn(`Distance fallback to estimate: ${reason}`),
  });
  return Response.json(result);
}
