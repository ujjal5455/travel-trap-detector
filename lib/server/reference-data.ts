// Small, rarely changing tables, cached for an hour across requests.
import "server-only";
import { cacheLife } from "next/cache";
import type { Area, FareBenchmark, Place } from "../types";
import { listAreas, listBenchmarks, listPlaces } from "./repo";

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
