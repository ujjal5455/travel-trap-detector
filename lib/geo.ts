import type { Area, LatLng } from "./types";

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function withinRadiusKm(center: LatLng, point: LatLng, radiusKm: number): boolean {
  return haversineKm(center, point) <= radiusKm;
}

/**
 * The area whose circle contains the point; if circles overlap, the one with the nearest centre.
 * null means the point is outside every area, so the regional default benchmark applies.
 */
export function nearestArea<T extends Area>(point: LatLng, areas: readonly T[]): T | null {
  let best: T | null = null;
  let bestKm = Infinity;
  for (const area of areas) {
    const km = haversineKm({ lat: area.centerLat, lng: area.centerLng }, point);
    if (km <= area.radiusKm && km < bestKm) {
      best = area;
      bestKm = km;
    }
  }
  return best;
}

export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
