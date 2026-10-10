import { FareCheckForm } from "@/components/fare-check/FareCheckForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default function FareCheckPage() {
  return (
    <main>
      <PageHeader
        title="Check a fare"
        subtitle="Enter your trip and the price you were quoted. We'll tell you if it looks fair, and why."
      />
      <FareCheckForm />
    </main>
  );
}
