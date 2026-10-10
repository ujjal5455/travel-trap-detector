import { describe, expect, it } from "vitest";
import { DEMO_SCENARIOS } from "@/lib/demo-scenarios";
import { offlineCheck } from "@/lib/offline-check";
import { scoreFare, selectBenchmark } from "@/lib/scoring";
import { noonInIndiaToday } from "@/lib/time";
import type { FareBenchmark, OfflinePack } from "@/lib/types";

// The seed rate cards these scenarios rely on (supabase/seed.sql).
const b = (areaId: string | null, serviceType: FareBenchmark["serviceType"], base: number, perKm: number, min: number, night: number): FareBenchmark => ({
  id: `${areaId}-${serviceType}`, areaId, serviceType, pricingUnit: "per_km", baseFare: base, perKmRate: perKm, minFare: min,
  nightMultiplier: night, nightStart: 22, nightEnd: 5, sessionRates: null, source: "demo_estimate", sourceNote: null,
});
const guide = (areaId: string, half: number, full: number): FareBenchmark => ({
  ...b(areaId, "guide", 0, 0, 0, 1), pricingUnit: "per_session", baseFare: null, perKmRate: null, minFare: null, sessionRates: { half_day: half, full_day: full },
});
const pack: OfflinePack = {
  version: 1,
  savedAt: "2026-10-10T00:00:00Z",
  areas: [
    { id: "guwahati", name: "Guwahati", state: "Assam", centerLat: 26.1805978, centerLng: 91.753943, radiusKm: 22 },
    { id: "kaziranga", name: "Kaziranga (Kohora)", state: "Assam", centerLat: 26.5869979, centerLng: 93.4105813, radiusKm: 45 },
  ],
  places: [],
  benchmarks: [b("guwahati", "auto", 40, 18, 50, 1.25), b("guwahati", "taxi", 70, 20.34, 190, 1), guide("kaziranga", 1000, 1800)],
};

/** Road distances measured with OpenRouteService / OSRM for these routes. */
const ROAD_KM: Record<string, number> = { "fair-auto": 5.2, "suspicious-airport-taxi": 21.9, "high-risk-station": 6.8 };
const NOON = noonInIndiaToday(new Date("2026-10-10T20:00:00Z")); // evening UTC, already the 11th in India

describe("demo scenarios give their intended verdict", () => {
  it.each(DEMO_SCENARIOS.map((s) => [s.title, s] as const))("%s, with the estimated distance (offline path)", (_t, s) => {
    const res = offlineCheck(pack, {
      serviceType: s.serviceType,
      pickup: s.pickup,
      drop: s.drop ?? undefined,
      sessionType: s.sessionType ?? undefined,
      quotedPrice: s.quotedPrice,
      tripTime: NOON.toISOString(),
    });
    expect(res.verdict.verdict).toBe(s.expect);
  });

  it.each(DEMO_SCENARIOS.filter((s) => s.serviceType !== "guide").map((s) => [s.title, s] as const))(
    "%s, with the road distance and no traveller reports",
    (_t, s) => {
      const v = scoreFare({
        serviceType: s.serviceType,
        quotedPrice: s.quotedPrice,
        areaId: "guwahati",
        pickup: s.pickup,
        distanceKm: ROAD_KM[s.id],
        distanceMethod: "road",
        sessionType: null,
        tripTime: NOON,
        now: NOON,
        benchmark: selectBenchmark(pack.benchmarks, "guwahati", s.serviceType),
        communityReports: [],
        scamReports: [],
      });
      expect(v.verdict).toBe(s.expect);
    },
  );

  it("covers fair, suspicious, high risk and a guide", () => {
    expect(DEMO_SCENARIOS.map((s) => s.expect)).toEqual(["FAIR", "SUSPICIOUS", "HIGH_RISK", "SUSPICIOUS"]);
    expect(DEMO_SCENARIOS.some((s) => s.serviceType === "guide")).toBe(true);
  });
});

describe("noonInIndiaToday", () => {
  it("is 06:30 UTC on the India date", () => {
    expect(noonInIndiaToday(new Date("2026-10-10T20:00:00Z")).toISOString()).toBe("2026-10-11T06:30:00.000Z");
    expect(noonInIndiaToday(new Date("2026-10-10T10:00:00Z")).toISOString()).toBe("2026-10-10T06:30:00.000Z");
  });
});
