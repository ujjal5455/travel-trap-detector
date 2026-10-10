// Small, rarely changing tables, cached for an hour across requests.
import "server-only";
import { cacheLife } from "next/cache";
import type { Area, FareBenchmark, FixedFare, Place } from "../types";
import { listAreas, listBenchmarks, listFixedFares, listPlaces } from "./repo";

export async function getAreas(): Promise<Area[]> {
  "use cache";
  cacheLife("hours");
  return listAreas();
}

export async function getBenchmarks(): Promise<FareBenchmark[]> {
  "use cache";
  cacheLife("hours");
  return listBenchmarks();
}

export async function getPlaces(): Promise<Place[]> {
  "use cache";
  cacheLife("hours");
  return listPlaces();
}

export async function getFixedFares(): Promise<FixedFare[]> {
  "use cache";
  cacheLife("hours");
  return listFixedFares();
}

/** Fixed fares are optional extra data: if the table is missing or unreachable, score with the rate card. */
export function getFixedFaresOrNone(): Promise<FixedFare[]> {
  return getFixedFares().catch((err: unknown) => {
    console.warn("Fixed fares unavailable, using rate cards only:", err instanceof Error ? err.message : err);
    return [];
  });
}
