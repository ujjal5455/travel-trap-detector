"use client";

import { useState } from "react";
import { DEMO_SCENARIOS, type DemoScenario } from "@/lib/demo-scenarios";
import { VERDICT_LABELS } from "@/lib/labels";

/** "Try a demo": fills the form with a preset trip so the presenter only taps "Check this fare". */
export function DemoPicker({ onPick }: { onPick: (scenario: DemoScenario) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border-2 border-dashed border-brand/50 p-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="demo-list"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between rounded-lg px-2 text-left font-semibold text-brand"
      >
        <span>
          <span aria-hidden="true">▶ </span>Try a demo
        </span>
        <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul id="demo-list" className="mt-1 grid gap-2">
          {DEMO_SCENARIOS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(s);
                  setOpen(false);
                }}
                className="flex min-h-12 w-full flex-col items-start rounded-lg border-2 border-line bg-surface px-3 py-2 text-left"
              >
                <span className="font-semibold">{s.title}</span>
                <span className="text-xs text-muted">
                  {s.point} Expect: {VERDICT_LABELS[s.expect].title}.
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
