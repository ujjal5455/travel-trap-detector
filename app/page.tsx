import { PageHeader } from "@/components/ui/PageHeader";

export default function FareCheckPage() {
  return (
    <main>
      <PageHeader
        title="Check a fare"
        subtitle="Enter your trip and the price you were quoted. We'll tell you if it looks fair, and why."
      />
      <p className="px-4 text-sm text-muted">The fare check form arrives in phase 5.</p>
    </main>
  );
}
