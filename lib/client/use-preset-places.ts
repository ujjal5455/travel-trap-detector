"use client";

import { useEffect, useState } from "react";
import type { OfflinePack, PlacesResponse } from "../types";
import { apiJson } from "./api";
import { loadOfflinePack } from "./offline-store";

// One request per page load, shared by every PlacePicker on the page.
let pending: Promise<PlacesResponse> | null = null;

/** The same shape as GET /api/places, built from the offline pack saved on this phone. */
export function placesFromPack(pack: OfflinePack): PlacesResponse {
  return {
    areas: [...pack.areas]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ id, name, state }) => ({
        id,
        name,
        state,
        places: pack.places
          .filter((p) => p.areaId === id)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((p) => ({ id: p.id, name: p.name, kind: p.kind, lat: p.lat, lng: p.lng })),
      })),
  };
}

function loadPresets(): Promise<PlacesResponse> {
  pending ??= apiJson<PlacesResponse>("/api/places").catch((err: unknown) => {
    pending = null; // allow a retry on the next mount
    // Offline (or server down): use the places saved on this phone, if any.
    const pack = loadOfflinePack();
    if (pack && pack.places.length > 0) return placesFromPack(pack);
    throw err;
  });
  return pending;
}

export function usePresetPlaces(): { data: PlacesResponse | null; error: string | null } {
  const [state, setState] = useState<{ data: PlacesResponse | null; error: string | null }>({ data: null, error: null });

  useEffect(() => {
    let active = true;
    loadPresets()
      .then((data) => active && setState({ data, error: null }))
      .catch((err: unknown) => active && setState({ data: null, error: err instanceof Error ? err.message : "Could not load places" }));
    return () => {
      active = false;
    };
  }, []);

  return state;
}
