// Domain types shared by the server, the client and the pure lib/ functions.
// Enum values mirror the check constraints in supabase/migrations.

export const SERVICE_TYPES = ["auto", "taxi", "bike_taxi", "shared_sumo", "guide"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SESSION_TYPES = ["half_day", "full_day"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const PRICING_UNITS = ["per_km", "per_session"] as const;
export type PricingUnit = (typeof PRICING_UNITS)[number];

export const BENCHMARK_SOURCES = ["official", "app_comparison", "demo_estimate"] as const;
export type BenchmarkSource = (typeof BENCHMARK_SOURCES)[number];

export const PLACE_KINDS = ["railway", "airport", "bus_stand", "temple", "market", "park", "other"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export const SCAM_TAGS = [
  "hidden_charges",
  "meter_refusal",
  "fake_closure_detour",
  "inflated_tourist_price",
  "luggage_surcharge",
  "wrong_change",
  "other",
] as const;
export type ScamTag = (typeof SCAM_TAGS)[number];

export const VERDICTS = ["FAIR", "SUSPICIOUS", "HIGH_RISK"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

/** "road" = OpenRouteService driving distance; "estimate" = Haversine × road factor. */
export const DISTANCE_METHODS = ["road", "estimate"] as const;
export type DistanceMethod = (typeof DISTANCE_METHODS)[number];

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Area {
  id: string;
  name: string;
  state: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
}

export interface Place extends LatLng {
  id: string;
  areaId: string;
  name: string;
  kind: PlaceKind;
}

export interface FareBenchmark {
  id: string;
  /** null = regional default */
  areaId: string | null;
  serviceType: ServiceType;
  pricingUnit: PricingUnit;
  baseFare: number | null;
  perKmRate: number | null;
  minFare: number | null;
  nightMultiplier: number;
  nightStart: number;
  nightEnd: number;
  sessionRates: Record<SessionType, number> | null;
  source: BenchmarkSource;
  sourceNote: string | null;
}

export interface FareVerdict {
  verdict: Verdict;
  ratio: number;
  expectedFare: number;
  fairRange: { min: number; max: number };
  /** null for guides (per-session pricing, no drop point) */
  distanceKm: number | null;
  distanceMethod: DistanceMethod | null;
  benchmarkSource: BenchmarkSource;
  communitySampleSize: number;
  nearbyScam: { count: number; distinctDevices: number; topTags: ScamTag[] };
  confidence: Confidence;
  reasons: string[];
}
