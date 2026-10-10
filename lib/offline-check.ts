// Fare check without a connection: same scoring engine, run in the browser on the saved offline pack.
// Distance is Haversine × 1.3, there is no community data, and the explanation is the template.
import { estimateDistance } from "./distance";
import { matchFixedFare } from "./fixed-fares";
import { templateExplanation } from "./explain";
import { nearestArea } from "./geo";
import { scoreFare, selectBenchmark } from "./scoring";
import type { CheckResponse, LatLng, OfflinePack, ServiceType, SessionType } from "./types";

export const OFFLINE_LABEL = "Offline estimate, community data not included";

export interface OfflineCheckRequest {
  serviceType: ServiceType;
  pickup: LatLng;
  drop?: LatLng;
  sessionType?: SessionType;
  tripTime?: string;
  quotedPrice: number;
}

export function offlineCheck(pack: OfflinePack, req: OfflineCheckRequest, now: Date = new Date()): CheckResponse {
  const isGuide = req.serviceType === "guide";
  const area = nearestArea(req.pickup, pack.areas);
  const distance = !isGuide && req.drop ? estimateDistance(req.pickup, req.drop) : null;
  const tripTime = req.tripTime ? new Date(req.tripTime) : now;

  const verdict = scoreFare({
    serviceType: req.serviceType,
    quotedPrice: req.quotedPrice,
    areaId: area?.id ?? null,
    pickup: req.pickup,
    distanceKm: distance?.distanceKm ?? null,
    distanceMethod: distance?.method ?? null,
    sessionType: isGuide ? (req.sessionType ?? null) : null,
    tripTime,
    now,
    benchmark: selectBenchmark(pack.benchmarks, area?.id ?? null, req.serviceType),
    // Packs saved before fixed fares existed have none.
    fixedFare: matchFixedFare(pack.fixedFares ?? [], req.serviceType, req.pickup, req.drop),
    communityReports: [],
    scamReports: [],
  });
  verdict.reasons.push(
    "You're offline, so this is an estimate from the rates saved on your phone. Traveller reports and scam warnings are not included.",
  );

  return {
    offline: true,
    checkId: null,
    verdict,
    explanation: templateExplanation(verdict),
    area: area ? { id: area.id, name: area.name } : null,
    serviceType: req.serviceType,
    sessionType: isGuide ? (req.sessionType ?? null) : null,
    quotedPrice: req.quotedPrice,
    tripTime: tripTime.toISOString(),
  };
}
