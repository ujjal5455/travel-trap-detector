"use client";

import { SERVICE_ICONS } from "@/components/ui/service-icons";
import { SERVICE_LABELS } from "@/lib/labels";
import { SERVICE_TYPES, type ServiceType } from "@/lib/types";

const SHORT_LABELS: Record<ServiceType, string> = {
  auto: "Auto",
  taxi: "Taxi",
  bike_taxi: "Bike taxi",
  shared_sumo: "Shared Sumo",
  guide: "Guide",
};

export function ServicePicker({ value, onChange }: { value: ServiceType | null; onChange: (s: ServiceType) => void }) {
  return (
    <div role="radiogroup" aria-label="Service" className="grid grid-cols-3 gap-2">
      {SERVICE_TYPES.map((service) => {
        const Icon = SERVICE_ICONS[service];
        const selected = value === service;
        return (
          <button
            key={service}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={SERVICE_LABELS[service]}
            onClick={() => onChange(service)}
            className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 text-sm font-medium transition-colors ${
              selected ? "border-brand bg-brand/10 text-brand" : "border-line bg-surface text-ink"
            }`}
          >
            <Icon />
            {SHORT_LABELS[service]}
          </button>
        );
      })}
    </div>
  );
}
