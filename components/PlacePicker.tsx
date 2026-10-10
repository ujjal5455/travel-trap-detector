"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useMemo, useState } from "react";
import { apiJson } from "@/lib/client/api";
import { usePresetPlaces } from "@/lib/client/use-preset-places";
import { PLACE_SEARCH } from "@/lib/config";
import { haversineKm } from "@/lib/geo";
import type { GeocodeResponse, LatLng, PlaceChoice } from "@/lib/types";

const MapPointPicker = dynamic(() => import("@/components/map/MapPointPicker"), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-lg bg-canvas" aria-label="Loading map" />,
});

/** Map opens here when nothing is chosen yet (central Guwahati). */
const DEFAULT_CENTER: LatLng = { lat: 26.1806, lng: 91.7539 };

type Mode = "preset" | "search" | "map";
const MODES: { id: Mode; label: string }[] = [
  { id: "preset", label: "Popular" },
  { id: "search", label: "Search" },
  { id: "map", label: "Map" },
];

interface Props {
  label: string;
  value: PlaceChoice | null;
  onChange: (place: PlaceChoice) => void;
  /** Centre the map near this point (e.g. the pickup, when choosing the drop). */
  near?: LatLng | null;
}

export function PlacePicker({ label, value, onChange, near }: Props) {
  const id = useId();
  const [mode, setMode] = useState<Mode>("preset");
  const presets = usePresetPlaces();

  const flatPresets = useMemo(
    () =>
      presets.data?.areas.flatMap((area) =>
        area.places.map((p) => ({ ...p, areaName: area.name })),
      ) ?? [],
    [presets.data],
  );

  function choosePreset(placeId: string) {
    const p = flatPresets.find((x) => x.id === placeId);
    if (p) onChange({ name: p.name, lat: p.lat, lng: p.lng, source: "preset", areaName: p.areaName });
  }

  return (
    <fieldset className="rounded-xl border border-line p-3">
      <legend className="px-1 text-sm font-semibold">{label}</legend>

      <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-canvas p-1" role="group" aria-label={`How to choose ${label.toLowerCase()}`}>
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`min-h-11 rounded-md text-sm font-medium ${mode === m.id ? "bg-surface text-brand shadow-sm" : "text-muted"}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "preset" && (
        <div>
          <label htmlFor={`${id}-preset`} className="sr-only">
            Popular places
          </label>
          {presets.error ? (
            <p className="text-sm text-risk">Couldn&apos;t load popular places. Use Search or Map instead.</p>
          ) : (
            <select
              id={`${id}-preset`}
              className="min-h-11 w-full rounded-lg border border-line bg-surface px-3"
              value={value?.source === "preset" ? (flatPresets.find((p) => p.name === value.name)?.id ?? "") : ""}
              onChange={(e) => choosePreset(e.target.value)}
              disabled={!presets.data}
            >
              <option value="" disabled>
                {presets.data ? "Choose a popular place…" : "Loading places…"}
              </option>
              {presets.data?.areas.map((area) => (
                <optgroup key={area.id} label={`${area.name}, ${area.state}`}>
                  {area.places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
        </div>
      )}

      {mode === "search" && <SearchPanel inputId={`${id}-search`} presets={flatPresets} onChange={onChange} />}

      {mode === "map" && (
        <div>
          <p className="mb-2 text-xs text-muted">Tap the map to set the point.</p>
          <MapPointPicker
            value={value}
            center={value ?? near ?? DEFAULT_CENTER}
            onPick={(p) => onChange({ ...p, name: "Point on map", source: "map" })}
          />
        </div>
      )}

      <p className="mt-3 min-h-5 text-sm" aria-live="polite">
        {value ? (
          <>
            <span className="font-medium">{value.name}</span>
            <span className="text-muted">
              {" · "}
              {value.areaName ?? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`}
            </span>
          </>
        ) : (
          <span className="text-muted">Nothing chosen yet</span>
        )}
      </p>
    </fieldset>
  );
}

type FlatPreset = { id: string; name: string; lat: number; lng: number; areaName: string };
type RemoteState = { q: string; results: GeocodeResponse["results"]; error?: string };

function SearchPanel({
  inputId,
  presets,
  onChange,
}: {
  inputId: string;
  presets: FlatPreset[];
  onChange: (place: PlaceChoice) => void;
}) {
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<RemoteState | null>(null);
  const q = query.trim();
  const searchable = q.length >= PLACE_SEARCH.minQueryLength;

  // Seeded places first (instant, no network), as docs/SPEC.md requires.
  const presetMatches = q.length >= 2 ? presets.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5) : [];

  useEffect(() => {
    if (!searchable) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      apiJson<GeocodeResponse>(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((res) => setRemote({ q, results: res.results }))
        .catch((err: unknown) => {
          if (!ctrl.signal.aborted) setRemote({ q, results: [], error: err instanceof Error ? err.message : "Search failed" });
        });
    }, PLACE_SEARCH.debounceMs);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, searchable]);

  const current = remote?.q === q ? remote : null;
  const loading = searchable && !current;
  // Hide OSM results that duplicate a preset we already show (within 100 m).
  const osmResults = (current?.results ?? []).filter(
    (r) => !presetMatches.some((p) => haversineKm(p, r) < 0.1),
  );

  return (
    <div>
      <label htmlFor={inputId} className="sr-only">
        Search for a place
      </label>
      <input
        id={inputId}
        type="search"
        inputMode="search"
        autoComplete="off"
        placeholder="e.g. Kamakhya, Police Bazar, hotel name"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="min-h-11 w-full rounded-lg border border-line bg-surface px-3"
      />

      <ul className="mt-2 divide-y divide-line">
        {presetMatches.map((p) => (
          <ResultButton
            key={p.id}
            title={p.name}
            subtitle={`${p.areaName} · popular place`}
            onClick={() => onChange({ name: p.name, lat: p.lat, lng: p.lng, source: "preset", areaName: p.areaName })}
          />
        ))}
        {osmResults.map((r) => (
          <ResultButton
            key={r.osmId}
            title={r.name}
            subtitle={r.displayName.split(",").slice(1, 4).join(",").trim()}
            onClick={() => onChange({ name: r.name, lat: r.lat, lng: r.lng, source: "search" })}
          />
        ))}
      </ul>

      <p className="mt-2 text-xs text-muted" aria-live="polite">
        {!searchable && q.length > 0 && presetMatches.length === 0 && `Type at least ${PLACE_SEARCH.minQueryLength} letters`}
        {loading && "Searching…"}
        {current?.error && current.error}
        {current && !current.error && osmResults.length === 0 && presetMatches.length === 0 && "No places found in North East India"}
        {current && osmResults.length > 0 && "Search results © OpenStreetMap contributors"}
      </p>
    </div>
  );
}

function ResultButton({ title, subtitle, onClick }: { title: string; subtitle: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex min-h-11 w-full flex-col items-start py-2 text-left">
        <span className="text-sm font-medium">{title}</span>
        {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
      </button>
    </li>
  );
}
