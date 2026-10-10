import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Offline" };

/** Shown by the service worker when a page that isn't cached is opened without a connection. */
export default function OfflinePage() {
  return (
    <main>
      <PageHeader title="You're offline" subtitle="This page isn't saved on your phone yet." />
      <div className="space-y-3 px-4 text-sm">
        <p>You can still check a fare: the app works out an offline estimate from the rates saved on your phone.</p>
        <Link href="/" className="flex min-h-12 items-center justify-center rounded-xl bg-brand px-4 font-semibold text-white">
          Check a fare offline
        </Link>
      </div>
    </main>
  );
}
