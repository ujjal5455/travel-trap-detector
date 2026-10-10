import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Scam map" };

export default function MapPage() {
  return (
    <main>
      <PageHeader title="Scam hotspots" subtitle="Places where travellers have recently reported problems." />
      <p className="px-4 text-sm text-muted">The hotspot map arrives in phase 8.</p>
    </main>
  );
}
