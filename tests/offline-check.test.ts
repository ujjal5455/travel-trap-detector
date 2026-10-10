import { describe, expect, it } from "vitest";
import { offlineCheck } from "@/lib/offline-check";
import type { OfflinePack } from "@/lib/types";

const STATION = { lat: 26.1823701, lng: 91.7501234 };
const KAMAKHYA = { lat: 26.165107, lng: 91.7059298 };
const NOON = "2026-10-10T06:30:00.000Z";

const pack: OfflinePack = {
  version: 1,
  savedAt: "2026-10-10T00:00:00.000Z",
  areas: [{ id: "guwahati", name: "Guwahati", state: "Assam", centerLat: 26.1805978, centerLng: 91.753943, radiusKm: 22 }],
  places: [],
  benchmarks: [
    { id: "a", areaId: "guwahati", serviceType: "auto", pricingUnit: "per_km", baseFare: 40, perKmRate: 18, minFare: 50, nightMultiplier: 1.25, nightStart: 22, nightEnd: 5, sessionRates: null, source: "demo_estimate", sourceNote: null },
    { id: "r", areaId: null, serviceType: "auto", pricingUnit: "per_km", baseFare: 40, perKmRate: 18, minFare: 50, nightMultiplier: 1.25, nightStart: 22, nightEnd: 5, sessionRates: null, source: "demo_estimate", sourceNote: null },
    { id: "g", areaId: null, serviceType: "guide", pricingUnit: "per_session", baseFare: null, perKmRate: null, minFare: null, nightMultiplier: 1, nightStart: 22, nightEnd: 5, sessionRates: { half_day: 1000, full_day: 1800 }, source: "demo_estimate", sourceNote: null },
  ],
};

describe("offlineCheck", () => {
  const res = offlineCheck(pack, { serviceType: "auto", pickup: STATION, drop: KAMAKHYA, quotedPrice: 400, tripTime: NOON });

  it("is marked offline and has no check id", () => {
    expect(res.offline).toBe(true);
    expect(res.checkId).toBeNull();
  });

  it("uses Haversine × 1.3 and the area benchmark", () => {
    expect(res.verdict.distanceKm).toBe(6.3);
    expect(res.verdict.distanceMethod).toBe("estimate");
    expect(res.verdict.expectedFare).toBe(153); // 40 + 18 × 6.3
    expect(res.area).toEqual({ id: "guwahati", name: "Guwahati" });
    expect(res.verdict.confidence).toBe("MEDIUM");
  });

  it("includes no community data, even at a seeded hotspot", () => {
    expect(res.verdict.communitySampleSize).toBe(0);
    expect(res.verdict.nearbyScam.count).toBe(0);
    expect(res.verdict.verdict).toBe("HIGH_RISK"); // 400 / 153 = 2.6, from price alone
  });

  it("says so in the reasons and uses the template explanation", () => {
    expect(res.verdict.reasons.at(-1)).toMatch(/offline.*not included/i);
    expect(res.verdict.reasons).toContain("Road distance was unavailable, so the distance is an estimate (straight line × 1.3).");
    expect(res.explanation.source).toBe("template");
  });

  it("falls back to the regional default outside every area", () => {
    const far = offlineCheck(pack, { serviceType: "auto", pickup: { lat: 25.9, lng: 91.88 }, drop: { lat: 25.95, lng: 91.9 }, quotedPrice: 100 });
    expect(far.area).toBeNull();
    expect(far.verdict.confidence).toBe("LOW");
  });

  it("prices guides by session with no distance", () => {
    const g = offlineCheck(pack, { serviceType: "guide", pickup: STATION, sessionType: "half_day", quotedPrice: 1000 });
    expect(g.verdict.expectedFare).toBe(1000);
    expect(g.verdict.distanceKm).toBeNull();
    expect(g.sessionType).toBe("half_day");
  });
});
