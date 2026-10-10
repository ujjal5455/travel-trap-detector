// Official fixed fares for specific routes (e.g. the Guwahati airport prepaid taxi list).
// A trip matches when its pickup is near the route's origin and its drop near the destination.
import { haversineKm } from "./geo";
import type { FixedFare, LatLng, ServiceType } from "./types";

/**
 * The fixed fare that applies to this trip, or null. If several destinations are in range
 * (neighbouring localities), the one whose centre is closest to the drop wins.
 */
export function matchFixedFare(
  fares: readonly FixedFare[],
  serviceType: ServiceType,
  pickup: LatLng,
  drop: LatLng | null | undefined,
): FixedFare | null {
  if (!drop) return null;
  let best: { fare: FixedFare; km: number } | null = null;
  for (const f of fares) {
    if (f.serviceType !== serviceType) continue;
    if (haversineKm(pickup, { lat: f.originLat, lng: f.originLng }) * 1000 > f.originRadiusM) continue;
    const km = haversineKm(drop, { lat: f.destLat, lng: f.destLng });
    if (km * 1000 > f.destRadiusM) continue;
    if (!best || km < best.km) best = { fare: f, km };
  }
  return best?.fare ?? null;
}
