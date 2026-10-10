import type { Metadata } from "next";
import { ReportPageClient } from "@/components/report/ReportPageClient";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Report" };

export default function ReportPage() {
  return (
    <main>
      <PageHeader
        title="Report a fare"
        subtitle="Tell other travellers what you paid, or flag a problem. Never include names, phone numbers or vehicle numbers."
      />
      <ReportPageClient />
    </main>
  );
}
