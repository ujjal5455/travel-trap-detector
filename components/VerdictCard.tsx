"use client";

import { useRouter } from "next/navigation";
import { ExplanationBlock } from "@/components/ExplanationBlock";
import type { Ref } from "react";
import { formatINR, formatKm, formatRatio } from "@/lib/format";
import { CONFIDENCE_LABELS, SOURCE_LABELS, VERDICT_LABELS } from "@/lib/labels";
import { saveReportDraft } from "@/lib/client/report-draft";
import type { CheckResponse, ReportDraft, Verdict } from "@/lib/types";

const STYLES: Record<Verdict, { band: string; text: string; border: string }> = {
  FAIR: { band: "bg-fair-soft", text: "text-fair", border: "border-fair" },
  SUSPICIOUS: { band: "bg-suspicious-soft", text: "text-suspicious", border: "border-suspicious" },
  HIGH_RISK: { band: "bg-risk-soft", text: "text-risk", border: "border-risk" },
};

function VerdictIcon({ verdict }: { verdict: Verdict }) {
  const common = { width: 36, height: 36, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (verdict === "FAIR") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="m7.5 12.5 3 3 6-6.5" />
      </svg>
    );
  }
  if (verdict === "SUSPICIOUS") {
    return (
      <svg {...common}>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9Z" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  );
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warn" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
        tone === "warn" ? "border-suspicious/40 bg-suspicious-soft text-suspicious" : "border-line bg-canvas text-muted"
      }`}
    >
      {children}
    </span>
  );
}

export function VerdictCard({
  result,
  draft,
  headingRef,
}: {
  result: CheckResponse;
  /** Trip details to prefill the report form */
  draft: ReportDraft;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const router = useRouter();
  const { verdict: v, explanation, quotedPrice, area } = result;
  const style = STYLES[v.verdict];
  const label = VERDICT_LABELS[v.verdict];

  return (
    <article className={`overflow-hidden rounded-2xl border-2 ${style.border} bg-surface`} aria-labelledby="verdict-title">
      <header className={`flex items-center gap-3 px-4 py-4 ${style.band} ${style.text}`}>
        <VerdictIcon verdict={v.verdict} />
        <div>
          <h2 id="verdict-title" ref={headingRef} tabIndex={-1} className="text-2xl font-bold uppercase tracking-wide outline-none">
            {label.title}
          </h2>
          <p className="text-sm font-medium">{label.subtitle}</p>
        </div>
      </header>

      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="text-sm text-muted">Fair price</p>
          <p className="text-4xl font-bold tracking-tight">
            {formatINR(v.fairRange.min)} – {formatINR(v.fairRange.max)}
          </p>
          <p className="mt-1 text-sm text-muted">
            You were quoted <span className="font-semibold text-ink">{formatINR(quotedPrice)}</span> · expected about{" "}
            {formatINR(v.expectedFare)} ({formatRatio(v.ratio)})
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge tone={v.benchmarkSource === "demo_estimate" ? "warn" : "neutral"}>{SOURCE_LABELS[v.benchmarkSource]}</Badge>
          <Badge>{CONFIDENCE_LABELS[v.confidence]}</Badge>
          {v.distanceKm !== null && (
            <Badge>{v.distanceMethod === "road" ? `${formatKm(v.distanceKm)} by road` : `≈ ${formatKm(v.distanceKm)} (estimated)`}</Badge>
          )}
          <Badge>{area ? area.name : "Regional rate"}</Badge>
        </div>

        <section aria-labelledby="why-title">
          <h3 id="why-title" className="text-sm font-semibold">
            Why
          </h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {v.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>

        <ExplanationBlock verdict={v} fallback={explanation} />

        <div className="grid gap-2">
          <button
            type="button"
            disabled
            title="Coming soon"
            className="min-h-12 rounded-xl bg-ink px-4 font-semibold text-white disabled:opacity-50"
          >
            Show the driver <span className="text-xs font-normal">(coming soon)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              saveReportDraft(draft);
              router.push("/report");
            }}
            className="flex min-h-12 items-center justify-center rounded-xl border-2 border-line px-4 font-semibold"
          >
            Report what I paid
          </button>
        </div>

        {v.benchmarkSource === "demo_estimate" && (
          <p className="text-xs text-muted">
            Rates in this prototype are placeholders, not an official fare chart. Treat the verdict as a guide.
          </p>
        )}
      </div>
    </article>
  );
}
