"use client";
// Phase 3 test bench: pick two places and see the trip distance.
// Phase 5 folds this into the full fare check form.
import { useEffect, useState } from "react";
import { PlacePicker } from "@/components/PlacePicker";
import { apiJson } from "@/lib/client/api";
import { formatKm } from "@/lib/format";
import type { DistanceResponse, PlaceChoice } from "@/lib/types";

const tripKey = (a: PlaceChoice, b: PlaceChoice) => `${a.lat},${a.lng}>${b.lat},${b.lng}`;

export function RoutePreview() {
  const [pickup, setPickup] = useState<PlaceChoice | null>(null);
  const [drop, setDrop] = useState<PlaceChoice | null>(null);
  const [result, setResult] = useState<{ key: string; data?: DistanceResponse; error?: string } | null>(null);

  const key = pickup && drop ? tripKey(pickup, drop) : null;

  useEffect(() => {
    if (!pickup || !drop) return;
    const k = tripKey(pickup, drop);
    const ctrl = new AbortController();
    apiJson<DistanceResponse>("/api/distance", {
      method: "POST",
      body: JSON.stringify({ from: { lat: pickup.lat, lng: pickup.lng }, to: { lat: drop.lat, lng: drop.lng } }),
      signal: ctrl.signal,
    })
      .then((data) => setResult({ key: k, data }))
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) setResult({ key: k, error: err instanceof Error ? err.message : "Distance failed" });
      });
    return () => ctrl.abort();
  }, [pickup, drop]);

  const current = result?.key === key ? result : null;

  return (
    <section className="space-y-3 px-4 pb-6">
      <PlacePicker label="Pickup" value={pickup} onChange={setPickup} />
      <PlacePicker label="Drop" value={drop} onChange={setDrop} near={pickup} />

      <div className="rounded-xl bg-canvas p-4" aria-live="polite">
        <p className="text-sm text-muted">Trip distance</p>
        {!key && <p className="mt-1 text-sm">Choose a pickup and a drop.</p>}
        {key && !current && <p className="mt-1 text-sm">Working out the distance…</p>}
        {current?.error && <p className="mt-1 text-sm text-risk">{current.error}</p>}
        {current?.data && (
          <>
            <p className="mt-1 text-2xl font-bold">
              {current.data.method === "estimate" && "≈ "}
              {formatKm(current.data.distanceKm)}
            </p>
            <p className="mt-1 text-sm text-muted">
              {current.data.method === "road"
                ? `By road${current.data.durationMin ? `, about ${current.data.durationMin} min` : ""} (OpenRouteService)`
                : "Estimate: straight-line distance × 1.3. Road distance was unavailable."}
            </p>
            <p className="mt-1 font-mono text-xs text-muted">method: {current.data.method}</p>
          </>
        )}
      </div>
    </section>
  );
}
