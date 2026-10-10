"use client";
// Client-only: Leaflet touches `window` on import. Always load through next/dynamic with ssr: false.
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import type { LatLng } from "@/lib/types";

// Leaflet's default marker works out its image URLs from the CSS file's location. Once a bundler
// rewrites asset paths that guess is wrong and markers render as broken images. Point it at copies
// in /public/leaflet instead.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

interface Props {
  value: LatLng | null;
  center: LatLng;
  onPick: (point: LatLng) => void;
}

function TapToPick({ onPick }: { onPick: Props["onPick"] }) {
  useMapEvents({
    click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

export default function MapPointPicker({ value, center, onPick }: Props) {
  const start = value ?? center;
  return (
    // `isolate` keeps Leaflet's high z-index panes from covering the fixed bottom nav.
    <div className="isolate overflow-hidden rounded-lg border border-line">
      <MapContainer center={[start.lat, start.lng]} zoom={value ? 15 : 13} scrollWheelZoom={false} className="h-56 w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <TapToPick onPick={onPick} />
        {value && <Marker position={[value.lat, value.lng]} />}
      </MapContainer>
    </div>
  );
}
