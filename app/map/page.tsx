import type { Metadata } from "next";
import { HotspotsView } from "@/components/map/HotspotsView";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Scam map" };

export default function MapPage() {
  return (
    <main>
      <PageHeader
        title="Scam hotspots"
        subtitle="Places where several travellers have recently reported problems. We show places and patterns, never individual people."
      />
      <HotspotsView />
    </main>
  );
}
