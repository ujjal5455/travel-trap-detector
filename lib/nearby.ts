// Turns raw report rows into the public "nearby" list: exact radius, newest first, vote counts,
// and nothing that identifies a device or exposes a photo.
import { haversineKm } from "./geo";
import type { LatLng, NearbyReport, ReportRow } from "./types";

type Row = Pick<
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

const num = (v: number | string | null) => (v === null ? null : Number(v));

export function toNearbyReports(
  rows: readonly Row[],
  votes: readonly { report_id: string; device_id: string }[],
  origin: LatLng,
  viewerDeviceId: string | null,
  radiusKm: number,
  limit: number,
): NearbyReport[] {
  return rows
    .map((r) => ({ r, km: haversineKm(origin, { lat: r.pickup_lat, lng: r.pickup_lng }) }))
    .filter(({ km }) => km <= radiusKm)
    .sort((a, b) => b.r.created_at.localeCompare(a.r.created_at))
    .slice(0, limit)
    .map(({ r, km }) => {
      const reportVotes = votes.filter((v) => v.report_id === r.id);
      return {
        id: r.id,
        serviceType: r.service_type,
        sessionType: r.session_type,
        distanceKm: num(r.distance_km),
        quotedPrice: num(r.quoted_price),
        paidPrice: num(r.paid_price),
        feltFair: r.felt_fair,
        isScam: r.is_scam,
        scamTags: r.scam_tags,
        description: r.description,
        hasEvidence: r.photo_path !== null,
        createdAt: r.created_at,
        metersAway: Math.round(km * 1000),
        votes: reportVotes.length,
        votedByMe: viewerDeviceId !== null && reportVotes.some((v) => v.device_id === viewerDeviceId),
        isMine: viewerDeviceId !== null && r.device_id === viewerDeviceId,
      };
    });
}
