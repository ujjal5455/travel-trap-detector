"use client";

import { useEffect, useState } from "react";
import type { PlacesResponse } from "../types";
import { apiJson } from "./api";

// One request per page load, shared by every PlacePicker on the page.
let pending: Promise<PlacesResponse> | null = null;

function loadPresets(): Promise<PlacesResponse> {
  pending ??= apiJson<PlacesResponse>("/api/places").catch((err: unknown) => {
    pending = null; // allow a retry on the next mount
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
