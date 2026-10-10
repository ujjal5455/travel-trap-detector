"use client";

import { useEffect, useState } from "react";
import { ApiError, apiJson } from "@/lib/client/api";
import { REPORTS } from "@/lib/config";
import { formatINR, formatMeters, formatTimeAgo } from "@/lib/format";
import { SCAM_TAG_LABELS, SERVICE_LABELS, SESSION_LABELS } from "@/lib/labels";
import type { LatLng, NearbyReport, NearbyReportsResponse, VoteResponse } from "@/lib/types";

type Load = { for: string; reports?: NearbyReport[]; error?: string };

/** Recent reports within 1 km of `origin`, with a "Me too" button. */
export function NearbyReports({ origin, highlightId }: { origin: LatLng; highlightId?: string }) {
  const key = `${origin.lat},${origin.lng}`;
  const [load, setLoad] = useState<Load | null>(null);
  const [votes, setVotes] = useState<Record<string, { votes: number; voted: boolean; error?: string }>>({});

  useEffect(() => {
    const ctrl = new AbortController();
    apiJson<NearbyReportsResponse>(`/api/reports/nearby?lat=${origin.lat}&lng=${origin.lng}`, { signal: ctrl.signal })
      .then((res) => setLoad({ for: key, reports: res.reports }))
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) setLoad({ for: key, error: err instanceof Error ? err.message : "Couldn't load reports" });
      });
    return () => ctrl.abort();
  }, [key, origin.lat, origin.lng]);

  async function meToo(report: NearbyReport) {
    try {
      const res = await apiJson<VoteResponse>(`/api/reports/${report.id}/vote`, { method: "POST" });
      setVotes((v) => ({ ...v, [report.id]: { votes: res.votes, voted: true } }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't save that. Try again.";
      const already = err instanceof ApiError && err.status === 409;
      setVotes((v) => ({ ...v, [report.id]: { votes: v[report.id]?.votes ?? report.votes, voted: already, error: message } }));
    }
  }

  const current = load?.for === key ? load : null;

  return (
    <section aria-labelledby="nearby-title" className="space-y-2">
      <h2 id="nearby-title" className="text-sm font-semibold">
        Recent reports within {REPORTS.nearbyRadiusKm} km
      </h2>
      {!current && <p className="text-sm text-muted">Loading reports…</p>}
      {current?.error && <p className="text-sm text-risk">{current.error}</p>}
      {current?.reports?.length === 0 && <p className="text-sm text-muted">No reports near here yet.</p>}
      <ul className="space-y-2">
        {current?.reports?.map((r) => {
          const v = votes[r.id] ?? { votes: r.votes, voted: r.votedByMe };
          const mine = r.isMine || r.id === highlightId;
          return (
            <li
              key={r.id}
              className={`rounded-xl border-2 p-3 text-sm ${r.id === highlightId ? "border-brand" : "border-line"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">
                  {r.isScam ? <span className="text-risk">⚠ Problem reported</span> : <span className="text-fair">✓ Fare report</span>}
                  <span className="font-normal text-muted">
                    {" · "}
                    {SERVICE_LABELS[r.serviceType]}
                    {r.sessionType ? ` (${SESSION_LABELS[r.sessionType]})` : r.distanceKm ? `, ${r.distanceKm} km` : ""}
                  </span>
                </p>
                <span className="shrink-0 text-xs text-muted">{formatTimeAgo(r.createdAt)}</span>
              </div>
              <p className="mt-1">
                {r.paidPrice !== null && <>Paid {formatINR(r.paidPrice)}</>}
                {r.paidPrice !== null && r.quotedPrice !== null && " · "}
                {r.quotedPrice !== null && <>Quoted {formatINR(r.quotedPrice)}</>}
                {r.feltFair !== null && <span className="text-muted"> · {r.feltFair ? "felt fair" : "felt unfair"}</span>}
              </p>
              {r.scamTags.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-1">
                  {r.scamTags.map((t) => (
                    <span key={t} className="rounded-full bg-risk-soft px-2 py-0.5 text-xs text-risk">
                      {SCAM_TAG_LABELS[t]}
                    </span>
                  ))}
                </p>
              )}
              {r.description && <p className="mt-1 text-muted">“{r.description}”</p>}
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-muted">
                  {formatMeters(r.metersAway)} away{r.hasEvidence && " · 📎 evidence attached"}
                </span>
                {mine ? (
                  <span className="text-xs font-medium text-brand">Your report</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void meToo(r)}
                    disabled={v.voted}
                    aria-pressed={v.voted}
                    className="min-h-11 rounded-lg border-2 border-line px-3 text-sm font-medium disabled:border-brand disabled:text-brand"
                  >
                    {v.voted ? "✓ Me too" : "Me too"} · {v.votes}
                  </button>
                )}
              </div>
              {v.error && (
                <p className="mt-1 text-xs text-muted" role="status">
                  {v.error}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
