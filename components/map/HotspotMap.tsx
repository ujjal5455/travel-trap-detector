"use client";
// Client-only (Leaflet touches `window`). Load through next/dynamic with ssr: false.
import "leaflet/dist/leaflet.css";
import type { CircleMarker as LeafletCircleMarker } from "leaflet";
import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { HOTSPOTS } from "@/lib/config";
import { hotspotLevel } from "@/lib/hotspots";
import type { HotspotsResponse, LatLng } from "@/lib/types";
import { HotspotSummary } from "./HotspotSummary";

type Hotspot = HotspotsResponse["hotspots"][number];

/** Pixel radius grows with the report count, within readable limits. */
const radiusFor = (count: number) => Math.min(30, 10 + count * 2);

function Recenter({ center, zoom }: { center: LatLng; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom);
  }, [map, center.lat, center.lng, zoom]);
  return null;
}

export default function HotspotMap({
  center,
  hotspots,
  selectedId,
}: {
  center: LatLng;
  hotspots: Hotspot[];
  selectedId: string | null;
}) {
  const markers = useRef(new Map<string, LeafletCircleMarker>());
  const mapRef = useRef<ReturnType<typeof useMap> | null>(null);

  // "Show on map" from the list: fly there and open the popup.
  useEffect(() => {
    if (!selectedId) return;
    const h = hotspots.find((x) => x.id === selectedId);
    const marker = markers.current.get(selectedId);
    if (h && mapRef.current) {
      mapRef.current.flyTo([h.lat, h.lng], 15, { duration: 0.6 });
      marker?.openPopup();
    }
  }, [selectedId, hotspots]);

  return (
    // `isolate` keeps Leaflet's high z-index panes below the fixed bottom nav.
    <div className="isolate overflow-hidden rounded-xl border border-line">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={12}
        scrollWheelZoom={false}
        className="h-80 w-full"
        ref={(m) => {
          mapRef.current = m;
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter center={center} zoom={12} />
        {hotspots.map((h) => {
          const level = hotspotLevel(h.count);
          return (
            <CircleMarker
              key={h.id}
              center={[h.lat, h.lng]}
              radius={radiusFor(h.count)}
              pathOptions={{ color: level.color, fillColor: level.color, fillOpacity: 0.35, weight: 2 }}
              ref={(m) => {
                if (m) markers.current.set(h.id, m);
                else markers.current.delete(h.id);
              }}
            >
              <Popup>
                <HotspotSummary hotspot={h} compact />
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <p className="sr-only">
        Each hotspot covers reports within {HOTSPOTS.cellRadiusMeters} m of its centre. The same hotspots are listed below the map.
      </p>
    </div>
  );
}
