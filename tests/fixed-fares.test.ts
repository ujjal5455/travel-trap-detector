import { describe, expect, it } from "vitest";
import { matchFixedFare } from "@/lib/fixed-fares";
import type { FixedFare } from "@/lib/types";

const AIRPORT = { lat: 26.1054933, lng: 91.5881147 };
const PALTAN = { lat: 26.1794742, lng: 91.7525068 };
const FANCY = { lat: 26.1799322, lng: 91.7362163 };

const fare = (destName: string, dest: { lat: number; lng: number }, amount: number, o: Partial<FixedFare> = {}): FixedFare => ({
  id: destName,
  areaId: "guwahati",
  serviceType: "taxi",
  originName: "LGBI Airport",
  originLat: AIRPORT.lat,
  originLng: AIRPORT.lng,
  originRadiusM: 2500,
  destName,
  destLat: dest.lat,
  destLng: dest.lng,
  destRadiusM: 1500,
  fare: amount,
  listedKm: 25,
  source: "official",
  sourceNote: "AAI prepaid taxi list",
  ...o,
});

const FARES = [fare("Paltan Bazaar", PALTAN, 580), fare("Fancy Bazaar", FANCY, 570)];
const north = (p: { lat: number; lng: number }, m: number) => ({ lat: p.lat + m / 111_320, lng: p.lng });

describe("matchFixedFare", () => {
  it("matches a taxi from the airport to a listed destination", () => {
    expect(matchFixedFare(FARES, "taxi", AIRPORT, north(PALTAN, 300))?.destName).toBe("Paltan Bazaar");
  });

  it("picks the closest destination when two overlap", () => {
    // ~1.6 km apart; a drop just next to Fancy Bazaar is within range of both
    expect(matchFixedFare(FARES, "taxi", AIRPORT, north(FANCY, 100))?.destName).toBe("Fancy Bazaar");
  });

  it("accepts pickups anywhere within the origin radius (other terminal, car park)", () => {
    expect(matchFixedFare(FARES, "taxi", north(AIRPORT, 2000), PALTAN)).not.toBeNull();
    expect(matchFixedFare(FARES, "taxi", north(AIRPORT, 2600), PALTAN)).toBeNull();
  });

  it("doesn't match the reverse direction, other services, far drops or missing drops", () => {
    expect(matchFixedFare(FARES, "taxi", PALTAN, AIRPORT)).toBeNull();
    expect(matchFixedFare(FARES, "auto", AIRPORT, PALTAN)).toBeNull();
    expect(matchFixedFare(FARES, "taxi", AIRPORT, north(PALTAN, 3000))).toBeNull();
    expect(matchFixedFare(FARES, "taxi", AIRPORT, null)).toBeNull();
  });
});
