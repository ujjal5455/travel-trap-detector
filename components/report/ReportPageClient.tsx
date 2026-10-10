"use client";

import dynamic from "next/dynamic";

// Client-only: the form reads the trip draft from sessionStorage on its first render.
const ReportForm = dynamic(() => import("./ReportForm").then((m) => m.ReportForm), {
  ssr: false,
  loading: () => (
    <div className="space-y-3 px-4" aria-label="Loading the report form">
      <div className="h-20 animate-pulse rounded-xl bg-canvas" />
      <div className="h-32 animate-pulse rounded-xl bg-canvas" />
      <div className="h-32 animate-pulse rounded-xl bg-canvas" />
    </div>
  ),
});

export function ReportPageClient() {
  return <ReportForm />;
}
