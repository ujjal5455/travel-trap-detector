import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Report" };

export default function ReportPage() {
  return (
    <main>
      <PageHeader
        title="Report a fare"
        subtitle="Tell other travellers what you paid, or flag a scam. Never include names, phone numbers or vehicle numbers."
      />
      <p className="px-4 text-sm text-muted">The report form arrives in phase 7.</p>
    </main>
  );
}
