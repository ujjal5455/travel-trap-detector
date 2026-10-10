import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "How it works" };

export default function AboutPage() {
  return (
    <main>
      <PageHeader
        title="How it works"
        subtitle="How we score fares, where the numbers come from, and what we can't know."
      />
      <p className="px-4 text-sm text-muted">The full explanation arrives in phase 11.</p>
    </main>
  );
}
