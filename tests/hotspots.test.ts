import { describe, expect, it } from "vitest";
import { findHotspots, hotspotLevel, overchargeRatio, type ScamPoint } from "@/lib/hotspots";
import type { Area, FareBenchmark, Place } from "@/lib/types";

const NOW = new Date("2026-10-10T06:30:00Z"); // 12:00 IST
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const STATION = { lat: 26.1823701, lng: 91.7501234 };
const AIRPORT = { lat: 26.1054933, lng: 91.5881147 };
const KAMAKHYA = { lat: 26.165107, lng: 91.7059298 };
/** Offset in metres north/east of a point. */
const at = (p: { lat: number; lng: number }, north: number, east: number) => ({
  lat: p.lat + north / 111_320,
  lng: p.lng + east / (111_320 * Math.cos((p.lat * Math.PI) / 180)),
});

const AUTO: FareBenchmark = {
  id: "b",
  areaId: "guwahati",
  serviceType: "auto",
  pricingUnit: "per_km",
  baseFare: 0,
  perKmRate: 10,
  minFare: 50,
  nightMultiplier: 1.5,
  nightStart: 22,
  nightEnd: 5,
  sessionRates: null,
  source: "demo_estimate",
  sourceNote: null,
};
const TAXI: FareBenchmark = { ...AUTO, id: "t", serviceType: "taxi", perKmRate: 20 };
const places: Place[] = [
  { id: "p1", areaId: "guwahati", name: "Guwahati Railway Station", kind: "railway", ...STATION },
  { id: "p2", areaId: "guwahati", name: "LGBI Airport (Terminal 1)", kind: "airport", ...AIRPORT },
];
const areas: Area[] = [{ id: "guwahati", name: "Guwahati", state: "Assam", centerLat: 26.18, centerLng: 91.75, radiusKm: 22 }];
const opts = { now: NOW, benchmarks: [AUTO, TAXI], places, areas };

let n = 0;
function point(where: { lat: number; lng: number }, deviceId: string, o: Partial<ScamPoint> = {}): ScamPoint {
  n += 1;
  return {
    id: `r${String(n).padStart(3, "0")}`,
    deviceId,
    serviceType: "auto",
    areaId: "guwahati",
    ...where,
    distanceKm: 10, // rate card ₹100
    sessionType: null,
    quotedPrice: 250,
    scamTags: ["inflated_tourist_price"],
    createdAt: daysAgo(10),
    ...o,
  };
}

describe("findHotspots", () => {
  const stationCluster = ["a", "a", "b", "c", "d", "e"].map((d, i) => point(at(STATION, (i - 3) * 60, (i % 2) * 80), d));
  const airportCluster = ["f", "g", "h"].map((d, i) => point(at(AIRPORT, i * 50, 0), d, { serviceType: "taxi", quotedPrice: 600 }));
  const kamakhyaTwoDevices = ["x", "y", "x"].map((d, i) => point(at(KAMAKHYA, i * 40, 0), d));
  const all = [...stationCluster, ...airportCluster, ...kamakhyaTwoDevices];

  it("returns cells with reports from at least 3 different devices, biggest first", () => {
    const hotspots = findHotspots(all, opts);
    expect(hotspots.map((h) => h.nearPlace)).toEqual(["Guwahati Railway Station", "LGBI Airport (Terminal 1)"]);
    expect(hotspots[0]).toMatchObject({ count: 6, distinctDevices: 5, areaName: "Guwahati" });
  });

  it("leaves out a cell whose reports come from only 2 devices", () => {
    expect(findHotspots(kamakhyaTwoDevices, opts)).toEqual([]);
  });

  it("leaves out 3 reports from a single device", () => {
    expect(findHotspots(["z", "z", "z"].map((d) => point(STATION, d)), opts)).toEqual([]);
  });

  it("only counts the last 90 days", () => {
    const old = ["a", "b", "c"].map((d) => point(STATION, d, { createdAt: daysAgo(91) }));
    expect(findHotspots(old, opts)).toEqual([]);
  });

  it("filters by service type", () => {
    expect(findHotspots(all, { ...opts, serviceType: "taxi" }).map((h) => h.nearPlace)).toEqual(["LGBI Airport (Terminal 1)"]);
    expect(findHotspots(all, { ...opts, serviceType: "guide" })).toEqual([]);
  });

  it("doesn't split a tight cluster that straddles where a grid line would be", () => {
    // Six reports from six devices spread 200 m east-west across one spot.
    const straddling = ["a", "b", "c", "d", "e", "f"].map((d, i) => point(at(STATION, 0, -100 + i * 40), d));
    const hotspots = findHotspots(straddling, opts);
    expect(hotspots).toHaveLength(1);
    expect(hotspots[0].count).toBe(6);
  });

  it("reports top tags, typical overcharge and the last report date", () => {
    const pts = [
      point(STATION, "a", { scamTags: ["meter_refusal", "luggage_surcharge"], quotedPrice: 200, createdAt: daysAgo(30) }),
      point(STATION, "b", { scamTags: ["meter_refusal"], quotedPrice: 300, createdAt: daysAgo(2) }),
      point(STATION, "c", { scamTags: ["luggage_surcharge", "wrong_change", "meter_refusal"], quotedPrice: null, createdAt: daysAgo(5) }),
    ];
    const [h] = findHotspots(pts, opts);
    expect(h.topTags).toEqual(["meter_refusal", "luggage_surcharge", "wrong_change"]);
    expect(h.typicalOvercharge).toBe(2.5); // median of 2.0 and 3.0; the report without a quote is skipped
    expect(h.lastReportAt).toBe(daysAgo(2).toISOString());
  });

  it("never exposes device IDs", () => {
    expect(JSON.stringify(findHotspots(all, opts))).not.toMatch(/"(a|b|c|d|e|f|g|h)"/);
  });
});

describe("overchargeRatio", () => {
  it("divides the quote by the rate-card fare for that trip", () => {
    expect(overchargeRatio(point(STATION, "a", { quotedPrice: 250 }), [AUTO])).toBe(2.5);
  });

  it("applies the night rate using the report time", () => {
    const night = new Date("2026-10-09T17:30:00Z"); // 23:00 IST → ₹150
    expect(overchargeRatio(point(STATION, "a", { quotedPrice: 300, createdAt: night }), [AUTO])).toBe(2);
  });

  it("is null without a quote or a matching benchmark", () => {
    expect(overchargeRatio(point(STATION, "a", { quotedPrice: null }), [AUTO])).toBeNull();
    expect(overchargeRatio(point(STATION, "a", { serviceType: "guide" }), [AUTO])).toBeNull();
  });
});

describe("hotspotLevel", () => {
  it("bands counts with a text label", () => {
    expect(hotspotLevel(3).label).toBe("A few reports");
    expect(hotspotLevel(7).label).toBe("Several reports");
    expect(hotspotLevel(12).label).toBe("Many reports");
  });
});
