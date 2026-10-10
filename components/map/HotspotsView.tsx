"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { preconnect } from "react-dom";
import { apiJson } from "@/lib/client/api";
import { HOTSPOTS } from "@/lib/config";
import { hotspotLevel } from "@/lib/hotspots";
import { SERVICE_LABELS } from "@/lib/labels";
import { SERVICE_TYPES, type HotspotsResponse, type LatLng, type ServiceType } from "@/lib/types";
import { HotspotSummary, hotspotTitle } from "./HotspotSummary";

const HotspotMap = dynamic(() => import("./HotspotMap"), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-xl bg-canvas" aria-label="Loading map" />,
});

/** Central Guwahati: the fallback when location isn't shared. */
const GUWAHATI: LatLng = { lat: 26.1806, lng: 91.7539 };

type LocationState = "guwahati" | "asking" | "yours" | "unavailable";
type Load = { for: string; data?: HotspotsResponse; error?: string };

export function HotspotsView() {
  // Start fetching the first map tiles' server while the map code loads.
  preconnect("https://tile.openstreetmap.org");

  const [service, setService] = useState<ServiceType | null>(null);
  const [center, setCenter] = useState<LatLng>(GUWAHATI);
  const [location, setLocation] = useState<LocationState>("guwahati");
  const [load, setLoad] = useState<Load | null>(null);
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Centre on the traveller if they allow it. The position stays in the browser; it is never sent to the server.
  function locate() {
    if (!("geolocation" in navigator)) {
      setLocation("unavailable");
      return;
    }
    setLocation("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocation("yours");
      },
      () => setLocation("unavailable"),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  }

  // Use the location straight away only if permission was already given; never prompt on page load.
  useEffect(() => {
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((status) => {
        if (status.state === "granted") locate();
      })
      .catch(() => undefined);
  }, []);

  const key = `${service ?? "all"}#${retry}`;
  useEffect(() => {
    const ctrl = new AbortController();
    const qs = service ? `?service_type=${service}` : "";
    apiJson<HotspotsResponse>(`/api/hotspots${qs}`, { signal: ctrl.signal })
      .then((data) => setLoad({ for: key, data }))
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) setLoad({ for: key, error: err instanceof Error ? err.message : "Couldn't load hotspots" });
      });
    return () => ctrl.abort();
  }, [key, service]);

  const current = load?.for === key ? load : null;
  const hotspots = current?.data?.hotspots ?? [];

  return (
    <div className="space-y-4 px-4 pb-8">
      <div role="radiogroup" aria-label="Filter by service" className="flex flex-wrap gap-2">
        {[null, ...SERVICE_TYPES].map((s) => (
          <button
            key={s ?? "all"}
            type="button"
            role="radio"
            aria-checked={service === s}
            onClick={() => {
              setService(s);
              setSelectedId(null);
            }}
            className={`min-h-11 rounded-full border-2 px-3 text-sm font-medium ${
              service === s ? "border-brand bg-brand/10 text-brand" : "border-line"
            }`}
          >
            {s ? SERVICE_LABELS[s] : "All"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted" aria-live="polite">
          {location === "guwahati" && "Showing Guwahati."}
          {location === "asking" && "Finding your location…"}
          {location === "yours" && "Centred on your location. It stays on your phone and isn't sent anywhere."}
          {location === "unavailable" && "Couldn't get your location, so showing Guwahati."}
        </p>
        {location !== "yours" && (
          <button
            type="button"
            onClick={locate}
            disabled={location === "asking"}
            className="min-h-11 rounded-lg border-2 border-line px-3 text-sm font-medium disabled:opacity-50"
          >
            <span aria-hidden="true">📍 </span>Use my location
          </button>
        )}
      </div>

      <HotspotMap center={center} hotspots={hotspots} selectedId={selectedId} />

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Map legend">
        {[...HOTSPOTS.levels].reverse().map((l) => (
          <li key={l.label} className="flex items-center gap-1">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full border-2" style={{ borderColor: l.color, background: `${l.color}59` }} />
            {l.label} ({l.minCount}+)
          </li>
        ))}
      </ul>

      <section aria-labelledby="hotspot-list-title">
        <h2 id="hotspot-list-title" className="text-lg font-bold">
          Hotspots{service ? ` for ${SERVICE_LABELS[service].toLowerCase()}` : ""}
        </h2>
        <p className="text-sm text-muted">
          Places where at least {current?.data?.minDevices ?? 3} different travellers reported problems in the last{" "}
          {current?.data?.windowDays ?? 90} days, most reports first.
        </p>

        {!current && <p className="mt-3 text-sm text-muted">Loading hotspots…</p>}
        {current?.error && (
          <div role="alert" className="mt-3 rounded-xl border-2 border-risk bg-risk-soft p-3 text-sm">
            <p>{current.error}</p>
            <button type="button" onClick={() => setRetry((r) => r + 1)} className="mt-2 min-h-11 rounded-lg bg-ink px-4 font-semibold text-white">
              Try again
            </button>
          </div>
        )}
        {current?.data && hotspots.length === 0 && (
          <p className="mt-3 text-sm text-muted">No hotspots{service ? " for this service" : ""} right now. That&apos;s good news.</p>
        )}

        <ol className="mt-3 space-y-2">
          {hotspots.map((h) => {
            const level = hotspotLevel(h.count);
            return (
              <li key={h.id} className="rounded-xl border-2 p-3 text-sm" style={{ borderColor: level.color }}>
                <h3 className="font-semibold">{hotspotTitle(h)}</h3>
                <HotspotSummary hotspot={h} />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(h.id);
                    document.querySelector(".leaflet-container")?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="mt-2 min-h-11 rounded-lg border-2 border-line px-3 font-medium"
                >
                  Show on map
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
