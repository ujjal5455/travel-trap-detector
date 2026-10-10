// Trip distance: OpenRouteService driving-car first, Haversine × road factor as the fallback.
// Always reports which method produced the number.
import { DISTANCE } from "./config";
import { haversineKm, roundTo } from "./geo";
import { LruCache } from "./lru-cache";
import type { DistanceMethod, LatLng } from "./types";

export interface DistanceResult {
  distanceKm: number;
  durationMin?: number;
  method: DistanceMethod;
}

export interface DistanceOptions {
  apiKey?: string;
  fetchFn?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
  /** Override for tests; production uses the shared module cache. */
  cache?: LruCache<DistanceResult>;
  /** Called with the reason whenever the estimate is used instead of a road distance. */
  onFallback?: (reason: string) => void;
}

const roadCache = new LruCache<DistanceResult>(DISTANCE.cacheMaxEntries);

export function estimateDistance(from: LatLng, to: LatLng): DistanceResult {
  return { distanceKm: roundTo(haversineKm(from, to) * DISTANCE.roadFactor, 1), method: "estimate" };
}

export function distanceCacheKey(from: LatLng, to: LatLng): string {
  const r = (n: number) => roundTo(n, DISTANCE.cacheDecimals).toFixed(DISTANCE.cacheDecimals);
  return `${r(from.lat)},${r(from.lng)}>${r(to.lat)},${r(to.lng)}`;
}

/** Throws on any failure; getDistance turns that into the estimate. */
export async function fetchRoadDistance(
  from: LatLng,
  to: LatLng,
  { apiKey, fetchFn = fetch, baseUrl = DISTANCE.orsBaseUrl, timeoutMs = DISTANCE.orsTimeoutMs }: DistanceOptions,
): Promise<DistanceResult> {
  if (!apiKey) throw new Error("ORS_API_KEY not set");

  const res = await fetchFn(`${baseUrl}/v2/directions/driving-car`, {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json", Accept: "application/json" },
    // ORS expects [lng, lat] pairs.
    body: JSON.stringify({ coordinates: [[from.lng, from.lat], [to.lng, to.lat]], instructions: false }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`ORS responded ${res.status}`);

  const body = (await res.json()) as { routes?: { summary?: { distance?: number; duration?: number } }[] };
  const summary = body.routes?.[0]?.summary;
  if (!summary) throw new Error("ORS returned no route");

  // ORS omits distance/duration when start and end are the same point.
  const meters = summary.distance ?? 0;
  const seconds = summary.duration ?? 0;
  if (!Number.isFinite(meters) || meters < 0) throw new Error("ORS returned an invalid distance");

  return { distanceKm: roundTo(meters / 1000, 1), durationMin: Math.round(seconds / 60), method: "road" };
}

/** Road distance when possible, otherwise the estimate. Never throws. Only road results are cached. */
export async function getDistance(from: LatLng, to: LatLng, options: DistanceOptions = {}): Promise<DistanceResult> {
  const cache = options.cache ?? roadCache;
  const key = distanceCacheKey(from, to);
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const result = await fetchRoadDistance(from, to, options);
    cache.set(key, result);
    return result;
  } catch (err) {
    const reason = err instanceof Error ? (err.name === "TimeoutError" ? "ORS timed out" : err.message) : String(err);
    options.onFallback?.(reason);
    return estimateDistance(from, to);
  }
}
