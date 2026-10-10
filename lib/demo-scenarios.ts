// Demo mode: four preset trips that fill the fare check form. Places use the seed coordinates.
// Each quote was chosen to give its verdict whether the distance comes from OpenRouteService or the
// straight-line estimate (incl. offline), at 12:00 India time so no night rate applies.
import type { PlaceChoice, ServiceType, SessionType, Verdict } from "./types";

export interface DemoScenario {
  id: string;
  title: string;
  /** What the demo shows, for the presenter */
  point: string;
  expect: Verdict;
  serviceType: ServiceType;
  pickup: PlaceChoice;
  drop: PlaceChoice | null;
  sessionType: SessionType | null;
  quotedPrice: number;
}

const place = (name: string, lat: number, lng: number, areaName: string): PlaceChoice => ({
  name,
  lat,
  lng,
  source: "preset",
  areaName,
});

const FANCY_BAZAAR = place("Fancy Bazaar", 26.1799322, 91.7362163, "Guwahati");
const KAMAKHYA = place("Kamakhya Temple", 26.165107, 91.7059298, "Guwahati");
const ISBT = place("ISBT Guwahati (Lokhra)", 26.1163561, 91.7218831, "Guwahati");
const AIRPORT = place("LGBI Airport (Terminal 1)", 26.1054933, 91.5881147, "Guwahati");
const STATION = place("Guwahati Railway Station", 26.1823701, 91.7501234, "Guwahati");
const KAZIRANGA = place("Kaziranga Central Range Safari Counter", 26.583824, 93.4031534, "Kaziranga (Kohora)");

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "fair-auto",
    title: "Fair auto ride",
    point: "Fancy Bazaar → Kamakhya Temple, quoted ₹130: close to the rate card.",
    expect: "FAIR",
    serviceType: "auto",
    pickup: FANCY_BAZAAR,
    drop: KAMAKHYA,
    sessionType: null,
    // Rate card: ₹134 by road (5.2 km) or ₹121 estimated (4.5 km) → 0.97–1.07×
    quotedPrice: 130,
  },
  {
    id: "suspicious-airport-taxi",
    title: "Suspicious airport taxi",
    point: "ISBT → Guwahati airport, quoted ₹750: above the usual fare, blended with traveller reports.",
    expect: "SUSPICIOUS",
    serviceType: "taxi",
    // Pickup away from the airport hotspot; a pickup at the airport itself would escalate to High risk.
    pickup: ISBT,
    drop: AIRPORT,
    sessionType: null,
    // Expected ≈ ₹592 by road with traveller reports (1.27×) or ₹483 estimated (1.55×)
    quotedPrice: 750,
  },
  {
    id: "high-risk-station",
    title: "High-risk ride from the station",
    point: "Railway Station → Kamakhya, quoted ₹400: far above the rate, at a reported scam hotspot.",
    expect: "HIGH_RISK",
    serviceType: "auto",
    pickup: STATION,
    drop: KAMAKHYA,
    sessionType: null,
    // Expected ≈ ₹163 (2.5×), plus the community warning from 4 travellers
    quotedPrice: 400,
  },
  {
    id: "kaziranga-guide",
    title: "Kaziranga guide quote",
    point: "Full-day guide at the Central Range, quoted ₹2,400: priced per session, not per km.",
    expect: "SUSPICIOUS",
    serviceType: "guide",
    pickup: KAZIRANGA,
    drop: null,
    sessionType: "full_day",
    // Full-day rate ₹1,800 → 1.33×
    quotedPrice: 2400,
  },
];
