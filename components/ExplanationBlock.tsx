"use client";
// Loads the explanation after the verdict card is already on screen.
// If /api/explain fails or is slow, shows the template explanation that came with the verdict.
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/client/api";
import { EXPLANATION } from "@/lib/config";
import type { Explanation, FareVerdict } from "@/lib/types";

export function ExplanationBlock({ verdict, fallback }: { verdict: FareVerdict; fallback: Explanation }) {
  const [loaded, setLoaded] = useState<{ for: FareVerdict; explanation: Explanation } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), EXPLANATION.clientTimeoutMs);
    apiJson<Explanation>("/api/explain", { method: "POST", body: JSON.stringify({ verdict }), signal: ctrl.signal })
      .then((explanation) => !cancelled && setLoaded({ for: verdict, explanation }))
      .catch(() => !cancelled && setLoaded({ for: verdict, explanation: fallback }))
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [verdict, fallback]);

  const explanation = loaded?.for === verdict ? loaded.explanation : null;

  return (
    <section className="rounded-xl bg-canvas p-3 text-sm" aria-labelledby="explain-title" aria-busy={!explanation}>
      <h3 id="explain-title" className="sr-only">
        Explanation
      </h3>
      {explanation ? (
        <>
          <p>{explanation.text}</p>
          <p className="mt-2">
            <span className="font-semibold">Tip: </span>
            {explanation.tip}
          </p>
          {explanation.source === "ai" && (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted">
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M12 3l1.8 4.6L18.5 9.5l-4.7 1.9L12 16l-1.8-4.6L5.5 9.5l4.7-1.9Z" />
              </svg>
              AI-written from the numbers above
            </p>
          )}
        </>
      ) : (
        <div className="animate-pulse space-y-2" aria-label="Writing a short explanation">
          <div className="h-3 w-full rounded bg-line" />
          <div className="h-3 w-11/12 rounded bg-line" />
          <div className="h-3 w-2/3 rounded bg-line" />
          <p className="pt-1 text-xs text-muted">Writing a short explanation…</p>
        </div>
      )}
    </section>
  );
}
