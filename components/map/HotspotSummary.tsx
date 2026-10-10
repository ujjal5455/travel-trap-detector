// Text description of one hotspot, shared by the map popup and the accessible list.
import { formatTimeAgo } from "@/lib/format";
import { hotspotLevel } from "@/lib/hotspots";
import { SCAM_TAG_LABELS } from "@/lib/labels";
import type { HotspotsResponse } from "@/lib/types";

type Hotspot = HotspotsResponse["hotspots"][number];

export function hotspotTitle(h: Hotspot): string {
  if (h.nearPlace) return `Near ${h.nearPlace}${h.areaName ? `, ${h.areaName}` : ""}`;
  return h.areaName ? `In ${h.areaName}` : `At ${h.lat.toFixed(4)}, ${h.lng.toFixed(4)}`;
}

export function HotspotSummary({ hotspot: h, compact = false }: { hotspot: Hotspot; compact?: boolean }) {
  const level = hotspotLevel(h.count);
  return (
    <div className={compact ? "text-sm" : ""}>
      {compact && <p className="font-semibold">{hotspotTitle(h)}</p>}
      <p className="font-medium" style={{ color: level.color }}>
        <span aria-hidden="true">⚠ </span>
        {level.label}: {h.count} reports from {h.distinctDevices} different travellers
      </p>
      {h.topTags.length > 0 && (
        <p>Most reported: {h.topTags.map((t) => SCAM_TAG_LABELS[t]).join(", ")}</p>
      )}
      {h.typicalOvercharge !== null && (
        <p>
          Quotes were typically <strong>{h.typicalOvercharge.toFixed(1)}×</strong> the usual fare
        </p>
      )}
      <p className="text-muted">Last report {formatTimeAgo(h.lastReportAt)}</p>
    </div>
  );
}
