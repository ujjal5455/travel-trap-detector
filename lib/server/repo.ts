// Typed database access. Maps snake_case rows to the camelCase domain types.
import "server-only";
import type { BoundingBox } from "../geo";
import type { ReportSample } from "../scoring";
import { getSupabase } from "../supabase-server";
import type {
  Area,
  AreaRow,
  FareBenchmark,
  FareBenchmarkRow,
  FareVerdict,
  Place,
  PlaceRow,
  ReportRow,
  ServiceType,
} from "../types";

const num = (v: number | string | null): number | null => (v === null ? null : Number(v));

export function toArea(row: AreaRow): Area {
  return {
    id: row.id,
    name: row.name,
    state: row.state,
    centerLat: row.center_lat,
    centerLng: row.center_lng,
    radiusKm: Number(row.radius_km),
  };
}

export function toPlace(row: PlaceRow): Place {
  return { id: row.id, areaId: row.area_id, name: row.name, kind: row.kind, lat: row.lat, lng: row.lng };
}

export function toBenchmark(row: FareBenchmarkRow): FareBenchmark {
  return {
    id: row.id,
    areaId: row.area_id,
    serviceType: row.service_type,
    pricingUnit: row.pricing_unit,
    baseFare: num(row.base_fare),
    perKmRate: num(row.per_km_rate),
    minFare: num(row.min_fare),
    nightMultiplier: Number(row.night_multiplier),
    nightStart: row.night_start,
    nightEnd: row.night_end,
    sessionRates: row.session_rates,
    source: row.source,
    sourceNote: row.source_note,
  };
}

/** Only the columns the scoring engine reads. */
const SAMPLE_COLUMNS =
  "device_id, area_id, service_type, pickup_lat, pickup_lng, distance_km, session_type, paid_price, is_scam, scam_tags, created_at";
type SampleRow = Pick<
  ReportRow,
  | "device_id"
  | "area_id"
  | "service_type"
  | "pickup_lat"
  | "pickup_lng"
  | "distance_km"
  | "session_type"
  | "paid_price"
  | "is_scam"
  | "scam_tags"
  | "created_at"
>;

export function toReportSample(row: SampleRow): ReportSample {
  return {
    deviceId: row.device_id,
    areaId: row.area_id,
    serviceType: row.service_type,
    pickupLat: row.pickup_lat,
    pickupLng: row.pickup_lng,
    distanceKm: num(row.distance_km),
    sessionType: row.session_type,
    paidPrice: num(row.paid_price),
    isScam: row.is_scam,
    scamTags: row.scam_tags,
    createdAt: new Date(row.created_at),
  };
}

export async function listAreas(): Promise<Area[]> {
  const { data, error } = await getSupabase()
    .from("areas")
    .select("*")
    .order("name")
    .overrideTypes<AreaRow[], { merge: false }>();
  if (error) throw new Error(`listAreas: ${error.message}`);
  return data.map(toArea);
}

export async function listPlaces(): Promise<Place[]> {
  const { data, error } = await getSupabase()
    .from("places")
    .select("*")
    .order("name")
    .overrideTypes<PlaceRow[], { merge: false }>();
  if (error) throw new Error(`listPlaces: ${error.message}`);
  return data.map(toPlace);
}

export async function listBenchmarks(): Promise<FareBenchmark[]> {
  const { data, error } = await getSupabase()
    .from("fare_benchmarks")
    .select("*")
    .overrideTypes<FareBenchmarkRow[], { merge: false }>();
  if (error) throw new Error(`listBenchmarks: ${error.message}`);
  return data.map(toBenchmark);
}

/** Non-scam reports with a paid price for the area + service since `since` (scoring filters further). */
export async function listCommunityCandidates(
  areaId: string,
  serviceType: ServiceType,
  since: Date,
): Promise<ReportSample[]> {
  const { data, error } = await getSupabase()
    .from("reports")
    .select(SAMPLE_COLUMNS)
    .eq("area_id", areaId)
    .eq("service_type", serviceType)
    .eq("is_scam", false)
    .not("paid_price", "is", null)
    .gte("created_at", since.toISOString())
    .limit(1000)
    .overrideTypes<SampleRow[], { merge: false }>();
  if (error) throw new Error(`listCommunityCandidates: ${error.message}`);
  return data.map(toReportSample);
}

/** Scam reports whose pickup is inside the box since `since` (scoring applies the exact radius). */
export async function listScamCandidates(box: BoundingBox, since: Date): Promise<ReportSample[]> {
  const { data, error } = await getSupabase()
    .from("reports")
    .select(SAMPLE_COLUMNS)
    .eq("is_scam", true)
    .gte("created_at", since.toISOString())
    .gte("pickup_lat", box.minLat)
    .lte("pickup_lat", box.maxLat)
    .gte("pickup_lng", box.minLng)
    .lte("pickup_lng", box.maxLng)
    .limit(1000)
    .overrideTypes<SampleRow[], { merge: false }>();
  if (error) throw new Error(`listScamCandidates: ${error.message}`);
  return data.map(toReportSample);
}

export async function countFareChecksSince(deviceId: string, since: Date): Promise<number> {
  const { count, error } = await getSupabase()
    .from("fare_checks")
    .select("id", { count: "exact", head: true })
    .eq("device_id", deviceId)
    .gte("created_at", since.toISOString());
  if (error || count === null) throw new Error(`countFareChecksSince: ${error?.message ?? "no count"}`);
  return count;
}

export async function insertFareCheck(check: {
  deviceId: string;
  areaId: string | null;
  serviceType: ServiceType;
  quotedPrice: number;
  verdict: FareVerdict;
}): Promise<string> {
  const { data, error } = await getSupabase()
    .from("fare_checks")
    .insert({
      device_id: check.deviceId,
      area_id: check.areaId,
      service_type: check.serviceType,
      distance_km: check.verdict.distanceKm,
      quoted_price: check.quotedPrice,
      verdict: check.verdict.verdict,
      // numeric(6,3) column: cap absurd ratios rather than fail the insert
      ratio: Math.min(check.verdict.ratio, 999.999),
      result: check.verdict,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(`insertFareCheck: ${error.message}`);
  return data.id;
}
