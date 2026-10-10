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

// ---------------------------------------------------------------------------
// Table row types: exactly what PostgREST returns (snake_case, timestamps as ISO strings).
// Keep in sync with supabase/migrations.

export interface AreaRow {
  id: string;
  name: string;
  state: string;
  center_lat: number;
  center_lng: number;
  radius_km: number;
}

export interface PlaceRow {
  id: string;
  area_id: string;
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
}

export interface FareBenchmarkRow {
  id: string;
  area_id: string | null;
  service_type: ServiceType;
  pricing_unit: PricingUnit;
  base_fare: number | null;
  per_km_rate: number | null;
  min_fare: number | null;
  night_multiplier: number;
  night_start: number;
  night_end: number;
  session_rates: Record<SessionType, number> | null;
  source: BenchmarkSource;
  source_note: string | null;
  updated_at: string;
}

export interface ReportRow {
  id: string;
  device_id: string;
  area_id: string | null;
  service_type: ServiceType;
  pickup_lat: number;
  pickup_lng: number;
  drop_lat: number | null;
  drop_lng: number | null;
  distance_km: number | null;
  session_type: SessionType | null;
  quoted_price: number | null;
  paid_price: number | null;
  felt_fair: boolean | null;
  is_scam: boolean;
  scam_tags: ScamTag[];
  description: string | null;
  photo_path: string | null;
  is_seed: boolean;
  created_at: string;
}

export interface ReportVoteRow {
  report_id: string;
  device_id: string;
  created_at: string;
}

export interface FareCheckRow {
  id: string;
  device_id: string;
  area_id: string | null;
  service_type: ServiceType;
  distance_km: number | null;
  quoted_price: number;
  verdict: Verdict;
  ratio: number;
  /** Full verdict, so /api/explain works from a checkId instead of trusting client JSON */
  result: FareVerdict | null;
  explanation: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------

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
