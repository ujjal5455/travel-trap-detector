// Groups recent scam reports into cells and keeps the ones reported by enough different devices.
// Cell radius = the community-warning radius (500 m), so map counts match the verdict card.
// Pure: the caller passes the reports, benchmarks and preset places.
//
// Cells are circles centred on the densest reports rather than a fixed grid: a fixed grid line can
// cut a tight cluster in two, leaving each half below the device threshold so the hotspot vanishes.
import { COMMUNITY_ESCALATION, HOTSPOTS } from "./config";
import { haversineKm } from "./geo";
import { benchmarkExpectedFare, median, selectBenchmark } from "./scoring";
import { SCAM_TAGS, type Area, type FareBenchmark, type Place, type ScamTag, type ServiceType, type SessionType } from "./types";

export interface ScamPoint {
  id: string;
  deviceId: string;
  serviceType: ServiceType;
  areaId: string | null;
  lat: number;
  lng: number;
  distanceKm: number | null;
  sessionType: SessionType | null;
  quotedPrice: number | null;
  scamTags: readonly ScamTag[];
  createdAt: Date;
}

export interface Hotspot {
  /** Stable for a given set of reports: the id of the cell's centre report */
  id: string;
  lat: number;
  lng: number;
  count: number;
  distinctDevices: number;
  topTags: ScamTag[];
  /** Median of quoted ÷ rate-card fare, 1 decimal; null when no report had a usable quote */
  typicalOvercharge: number | null;
  lastReportAt: string;
  /** Nearest preset place within 1 km, for the accessible list */
  nearPlace: string | null;
  areaName: string | null;
}

export interface HotspotOptions {
  now: Date;
  serviceType?: ServiceType;
  benchmarks: readonly FareBenchmark[];
  places: readonly Place[];
  areas: readonly Area[];
  radiusMeters?: number;
  minDevices?: number;
  windowDays?: number;
}

const DAY_MS = 86_400_000;

/** quoted ÷ rate-card fare for one report, or null if it can't be worked out. */
export function overchargeRatio(p: ScamPoint, benchmarks: readonly FareBenchmark[]): number | null {
  if (p.quotedPrice === null || p.quotedPrice <= 0) return null;
  try {
    const b = selectBenchmark(benchmarks, p.areaId, p.serviceType);
    const { expected } = benchmarkExpectedFare(b, p.distanceKm, p.sessionType, p.createdAt);
    return expected > 0 ? p.quotedPrice / expected : null;
  } catch {
    return null;
  }
}

function topTags(points: readonly ScamPoint[]): ScamTag[] {
  const counts = new Map<ScamTag, number>();
  for (const p of points) for (const t of p.scamTags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || SCAM_TAGS.indexOf(a[0]) - SCAM_TAGS.indexOf(b[0]))
    .slice(0, 3)
    .map(([t]) => t);
}

export function findHotspots(points: readonly ScamPoint[], opts: HotspotOptions): Hotspot[] {
  const radiusKm = (opts.radiusMeters ?? HOTSPOTS.cellRadiusMeters) / 1000;
  const minDevices = opts.minDevices ?? COMMUNITY_ESCALATION.minDistinctDevices;
  const since = opts.now.getTime() - (opts.windowDays ?? COMMUNITY_ESCALATION.windowDays) * DAY_MS;

  let remaining = points.filter(
    (p) =>
      p.createdAt.getTime() >= since &&
      p.createdAt.getTime() <= opts.now.getTime() &&
      (!opts.serviceType || p.serviceType === opts.serviceType),
  );
  const cells: ScamPoint[][] = [];

  while (remaining.length > 0) {
    // Centre the next cell on the report whose neighbourhood has the most distinct devices
    // (then most reports, then lowest id, so the result is deterministic).
    let best: { centre: ScamPoint; members: ScamPoint[]; devices: number } | null = null;
    for (const centre of remaining) {
      const members = remaining.filter((p) => haversineKm(centre, p) <= radiusKm);
      const devices = new Set(members.map((m) => m.deviceId)).size;
      if (
        !best ||
        devices > best.devices ||
        (devices === best.devices && members.length > best.members.length) ||
        (devices === best.devices && members.length === best.members.length && centre.id < best.centre.id)
      ) {
        best = { centre, members, devices };
      }
    }
    if (!best || best.devices < minDevices) break; // no remaining cell can qualify
    cells.push(best.members);
    const taken = new Set(best.members.map((m) => m.id));
    remaining = remaining.filter((p) => !taken.has(p.id));
  }

  return cells
    .map((members) => {
      const lat = members.reduce((s, m) => s + m.lat, 0) / members.length;
      const lng = members.reduce((s, m) => s + m.lng, 0) / members.length;
      const ratios = members.map((m) => overchargeRatio(m, opts.benchmarks)).filter((r): r is number => r !== null);
      const nearest = opts.places
        .map((pl) => ({ pl, km: haversineKm({ lat, lng }, pl) }))
        .filter((x) => x.km <= HOTSPOTS.placeNameRadiusKm)
        .sort((a, b) => a.km - b.km)[0];
      const areaId = nearest?.pl.areaId ?? members[0].areaId;
      return {
        id: [...members].sort((a, b) => a.id.localeCompare(b.id))[0].id,
        lat,
        lng,
        count: members.length,
        distinctDevices: new Set(members.map((m) => m.deviceId)).size,
        topTags: topTags(members),
        typicalOvercharge: ratios.length ? Math.round(median(ratios) * 10) / 10 : null,
        lastReportAt: new Date(Math.max(...members.map((m) => m.createdAt.getTime()))).toISOString(),
        nearPlace: nearest?.pl.name ?? null,
        areaName: opts.areas.find((a) => a.id === areaId)?.name ?? null,
      };
    })
    .sort((a, b) => b.count - a.count || b.distinctDevices - a.distinctDevices);
}

export function hotspotLevel(count: number) {
  return HOTSPOTS.levels.find((l) => count >= l.minCount) ?? HOTSPOTS.levels[HOTSPOTS.levels.length - 1];
}
