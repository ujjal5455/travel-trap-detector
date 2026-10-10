// Typed database reads. Maps snake_case rows to the camelCase domain types.
import "server-only";
import { getSupabase } from "../supabase-server";
import type { Area, AreaRow, Place, PlaceRow } from "../types";

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

export async function listAreas(): Promise<Area[]> {
  const { data, error } = await getSupabase().from("areas").select("*").order("name").overrideTypes<AreaRow[], { merge: false }>();
  if (error) throw new Error(`listAreas: ${error.message}`);
  return data.map(toArea);
}

export async function listPlaces(): Promise<Place[]> {
  const { data, error } = await getSupabase().from("places").select("*").order("name").overrideTypes<PlaceRow[], { merge: false }>();
  if (error) throw new Error(`listPlaces: ${error.message}`);
  return data.map(toPlace);
}
