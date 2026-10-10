import { describe, expect, it } from "vitest";
import { boundingBox, haversineKm, nearestArea, roundTo, withinRadiusKm } from "@/lib/geo";
import type { Area } from "@/lib/types";

const STATION = { lat: 26.1823701, lng: 91.7501234 }; // Guwahati Railway Station
const KAMAKHYA = { lat: 26.165107, lng: 91.7059298 };

const area = (id: string, centerLat: number, centerLng: number, radiusKm: number): Area => ({
  id,
  name: id,
  state: "Assam",
  centerLat,
  centerLng,
  radiusKm,
});

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    expect(haversineKm(STATION, STATION)).toBe(0);
  });

  it("matches a known distance: one degree of longitude at the equator ≈ 111.19 km", () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.19, 1);
  });

  it("gives the straight-line distance between two Guwahati places", () => {
    // Road distance is 6.8 km; straight line is shorter.
    expect(haversineKm(STATION, KAMAKHYA)).toBeCloseTo(4.82, 1);
  });

  it("is symmetric", () => {
    expect(haversineKm(STATION, KAMAKHYA)).toBe(haversineKm(KAMAKHYA, STATION));
  });
});

describe("withinRadiusKm", () => {
  it("includes points inside and on the edge, excludes points outside", () => {
    const d = haversineKm(STATION, KAMAKHYA);
    expect(withinRadiusKm(STATION, KAMAKHYA, d + 0.01)).toBe(true);
    expect(withinRadiusKm(STATION, KAMAKHYA, d)).toBe(true);
    expect(withinRadiusKm(STATION, KAMAKHYA, d - 0.01)).toBe(false);
  });

  it("works at the 500 m scale used for scam escalation", () => {
    const nearby = { lat: STATION.lat + 0.003, lng: STATION.lng }; // ≈ 334 m north
    expect(withinRadiusKm(STATION, nearby, 0.5)).toBe(true);
    expect(withinRadiusKm(STATION, { lat: STATION.lat + 0.006, lng: STATION.lng }, 0.5)).toBe(false);
  });
});

describe("nearestArea", () => {
  const guwahati = area("guwahati", 26.1805978, 91.753943, 22);
  const shillong = area("shillong", 25.5759931, 91.8827872, 20);

  it("returns the area containing the point", () => {
    expect(nearestArea(KAMAKHYA, [shillong, guwahati])?.id).toBe("guwahati");
  });

  it("returns null outside every area (regional default)", () => {
    const nongpoh = { lat: 25.9, lng: 91.88 }; // between Guwahati and Shillong
    expect(nearestArea(nongpoh, [guwahati, shillong])).toBeNull();
  });

  it("returns null when there are no areas", () => {
    expect(nearestArea(STATION, [])).toBeNull();
  });

  it("picks the nearest centre when circles overlap", () => {
    const big = area("big", 26.5, 91.75, 100);
    expect(nearestArea(STATION, [big, guwahati])?.id).toBe("guwahati");
  });
});

describe("boundingBox", () => {
  it("contains every point on the circle's edge", () => {
    const box = boundingBox(STATION, 0.5);
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      // a point ~499 m from the station in direction `deg`
      const p = {
        lat: STATION.lat + (0.499 / 111.195) * Math.cos(rad),
        lng: STATION.lng + (0.499 / (111.195 * Math.cos((STATION.lat * Math.PI) / 180))) * Math.sin(rad),
      };
      expect(haversineKm(STATION, p)).toBeLessThan(0.5);
      expect(p.lat >= box.minLat && p.lat <= box.maxLat && p.lng >= box.minLng && p.lng <= box.maxLng).toBe(true);
    }
  });

  it("is about ±0.0045° of latitude for 500 m", () => {
    const box = boundingBox(STATION, 0.5);
    expect(box.maxLat - STATION.lat).toBeCloseTo(0.0045, 4);
    expect(box.maxLng - STATION.lng).toBeGreaterThan(box.maxLat - STATION.lat); // longitude degrees are shorter
  });
});

describe("roundTo", () => {
  it("rounds to the given decimals", () => {
    expect(roundTo(26.18237012, 4)).toBe(26.1824);
    expect(roundTo(6.849, 1)).toBe(6.8);
  });
});
