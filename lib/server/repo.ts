// Typed database access. Maps snake_case rows to the camelCase domain types.
import "server-only";
import { EVIDENCE_PHOTO } from "../config";
import type { BoundingBox } from "../geo";
import type { ScamPoint } from "../hotspots";
import type { ReportSample } from "../scoring";
import { getSupabase } from "../supabase-server";
import type {
  Area,
  AreaRow,
  FareBenchmark,
  FareBenchmarkRow,
  FareVerdict,
  FixedFare,
  FixedFareRow,
  Place,
  PlaceRow,
  ReportRow,
  ScamTag,
  ServiceType,
  SessionType,
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

export function toFixedFare(row: FixedFareRow): FixedFare {
  return {
    id: row.id,
    areaId: row.area_id,
    serviceType: row.service_type,
    originName: row.origin_name,
    originLat: row.origin_lat,
    originLng: row.origin_lng,
    originRadiusM: row.origin_radius_m,
    destName: row.dest_name,
    destLat: row.dest_lat,
    destLng: row.dest_lng,
    destRadiusM: row.dest_radius_m,
    fare: Number(row.fare),
    listedKm: num(row.listed_km),
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

export async function listFixedFares(): Promise<FixedFare[]> {
  const { data, error } = await getSupabase()
    .from("fixed_fares")
    .select("*")
    .order("dest_name")
    .overrideTypes<FixedFareRow[], { merge: false }>();
  if (error) throw new Error(`listFixedFares: ${error.message}`);
  return data.map(toFixedFare);
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

// ---------------------------------------------------------------------------
// Reports

export async function countReportsSince(deviceId: string, since: Date): Promise<number> {
  const { count, error } = await getSupabase()
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("device_id", deviceId)
    .gte("created_at", since.toISOString());
  if (error || count === null) throw new Error(`countReportsSince: ${error?.message ?? "no count"}`);
  return count;
}

export interface NewReport {
  deviceId: string;
  areaId: string | null;
  serviceType: ServiceType;
  pickupLat: number;
  pickupLng: number;
  dropLat: number | null;
  dropLng: number | null;
  distanceKm: number | null;
  sessionType: SessionType | null;
  quotedPrice: number | null;
  paidPrice: number | null;
  feltFair: boolean | null;
  isScam: boolean;
  scamTags: ScamTag[];
  description: string | null;
  photoPath: string | null;
}

export async function insertReport(r: NewReport): Promise<string> {
  const { data, error } = await getSupabase()
    .from("reports")
    .insert({
      device_id: r.deviceId,
      area_id: r.areaId,
      service_type: r.serviceType,
      pickup_lat: r.pickupLat,
      pickup_lng: r.pickupLng,
      drop_lat: r.dropLat,
      drop_lng: r.dropLng,
      distance_km: r.distanceKm,
      session_type: r.sessionType,
      quoted_price: r.quotedPrice,
      paid_price: r.paidPrice,
      felt_fair: r.feltFair,
      is_scam: r.isScam,
      scam_tags: r.scamTags,
      description: r.description,
      photo_path: r.photoPath,
      is_seed: false,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(`insertReport: ${error.message}`);
  return data.id;
}

/** Columns for the nearby list. device_id is used to compute "isMine" and is never sent to the browser. */
const NEARBY_COLUMNS =
  "id, device_id, service_type, session_type, distance_km, quoted_price, paid_price, felt_fair, is_scam, scam_tags, description, photo_path, pickup_lat, pickup_lng, created_at";
export type NearbyRow = Pick<
  ReportRow,
  | "id"
  | "device_id"
  | "service_type"
  | "session_type"
  | "distance_km"
  | "quoted_price"
  | "paid_price"
  | "felt_fair"
  | "is_scam"
  | "scam_tags"
  | "description"
  | "photo_path"
  | "pickup_lat"
  | "pickup_lng"
  | "created_at"
>;

export async function listReportsInBox(box: BoundingBox, since: Date, limit: number): Promise<NearbyRow[]> {
  const { data, error } = await getSupabase()
    .from("reports")
    .select(NEARBY_COLUMNS)
    .gte("created_at", since.toISOString())
    .gte("pickup_lat", box.minLat)
    .lte("pickup_lat", box.maxLat)
    .gte("pickup_lng", box.minLng)
    .lte("pickup_lng", box.maxLng)
    .order("created_at", { ascending: false })
    .limit(limit)
    .overrideTypes<NearbyRow[], { merge: false }>();
  if (error) throw new Error(`listReportsInBox: ${error.message}`);
  return data;
}

export async function listVotes(reportIds: string[]): Promise<{ report_id: string; device_id: string }[]> {
  if (reportIds.length === 0) return [];
  const { data, error } = await getSupabase()
    .from("report_votes")
    .select("report_id, device_id")
    .in("report_id", reportIds)
    .overrideTypes<{ report_id: string; device_id: string }[], { merge: false }>();
  if (error) throw new Error(`listVotes: ${error.message}`);
  return data;
}

/** The reporting device, or null if the report doesn't exist. */
export async function getReportDevice(reportId: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("reports")
    .select("device_id")
    .eq("id", reportId)
    .maybeSingle<{ device_id: string }>();
  if (error) throw new Error(`getReportDevice: ${error.message}`);
  return data?.device_id ?? null;
}

/** "duplicate" when this device already voted: the (report_id, device_id) primary key rejects it. */
export async function insertVote(reportId: string, deviceId: string): Promise<"ok" | "duplicate"> {
  const { error } = await getSupabase().from("report_votes").insert({ report_id: reportId, device_id: deviceId });
  if (!error) return "ok";
  if (error.code === "23505") return "duplicate";
  throw new Error(`insertVote: ${error.message}`);
}

export async function countVotes(reportId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("report_votes")
    .select("report_id", { count: "exact", head: true })
    .eq("report_id", reportId);
  if (error || count === null) throw new Error(`countVotes: ${error?.message ?? "no count"}`);
  return count;
}

// ---------------------------------------------------------------------------
// Evidence photos (private bucket; never read back for display)

export async function createEvidenceUploadUrl(path: string): Promise<string> {
  const { data, error } = await getSupabase().storage.from(EVIDENCE_PHOTO.bucket).createSignedUploadUrl(path);
  if (error) throw new Error(`createEvidenceUploadUrl: ${error.message}`);
  return data.signedUrl;
}

export async function evidenceExists(path: string): Promise<boolean> {
  const { data, error } = await getSupabase().storage.from(EVIDENCE_PHOTO.bucket).exists(path);
  if (error) return false;
  return data;
}

// ---------------------------------------------------------------------------
// Hotspots

/** Scam reports since `since`, optionally for one service (device_id is used for counting only). */
export async function listScamPoints(since: Date, serviceType?: ServiceType): Promise<ScamPoint[]> {
  let query = getSupabase()
    .from("reports")
    .select("id, device_id, service_type, area_id, pickup_lat, pickup_lng, distance_km, session_type, quoted_price, scam_tags, created_at")
    .eq("is_scam", true)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(5000);
  if (serviceType) query = query.eq("service_type", serviceType);
  const { data, error } = await query.overrideTypes<
    Pick<
      ReportRow,
      | "id"
      | "device_id"
      | "service_type"
      | "area_id"
      | "pickup_lat"
      | "pickup_lng"
      | "distance_km"
      | "session_type"
      | "quoted_price"
      | "scam_tags"
      | "created_at"
    >[],
    { merge: false }
  >();
  if (error) throw new Error(`listScamPoints: ${error.message}`);
  return data.map((r) => ({
    id: r.id,
    deviceId: r.device_id,
    serviceType: r.service_type,
    areaId: r.area_id,
    lat: r.pickup_lat,
    lng: r.pickup_lng,
    distanceKm: num(r.distance_km),
    sessionType: r.session_type,
    quotedPrice: num(r.quoted_price),
    scamTags: r.scam_tags,
    createdAt: new Date(r.created_at),
  }));
}
