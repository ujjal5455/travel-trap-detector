"use client";

import Link from "next/link";
import { COMMUNITY_BLEND, COMMUNITY_ESCALATION } from "@/lib/config";
import type { PlaceChoice } from "@/lib/types";
import { NearbyReports } from "./NearbyReports";

export function ThankYou({
  redacted,
  newReportId,
  pickup,
  hadPhoto,
}: {
  redacted: boolean;
  newReportId: string;
  pickup: PlaceChoice;
  hadPhoto: boolean;
}) {
  return (
    <div className="space-y-6 px-4 pb-8">
      <section className="rounded-2xl border-2 border-fair bg-fair-soft p-4" aria-labelledby="thanks-title">
        <h2 id="thanks-title" className="text-xl font-bold text-fair">
          ✓ Thank you, your report is saved
        </h2>
        <p className="mt-2 text-sm">Here is how it helps the next traveller:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>
            <strong>Fare reports</strong>: once an area has {COMMUNITY_BLEND.minSamples} or more reports for similar trips,
            what travellers actually paid is blended into the expected fare, so future checks get more accurate.
          </li>
          <li>
            <strong>Problem reports</strong>: when {COMMUNITY_ESCALATION.minDistinctDevices} or more different travellers
            report problems within {COMMUNITY_ESCALATION.radiusMeters} m in {COMMUNITY_ESCALATION.windowDays} days, fare checks
            starting there carry a warning.
          </li>
          <li>Other travellers can tap &ldquo;Me too&rdquo; on your report if the same thing happened to them.</li>
        </ul>
        {redacted && (
          <p className="mt-3 rounded-lg bg-surface p-2 text-sm">
            We removed something that looked like a phone or vehicle number from your description. We flag places and
            patterns, never individual people.
          </p>
        )}
        {hadPhoto && <p className="mt-2 text-sm">Your photo is stored privately and is never shown to anyone.</p>}
        <div className="mt-4 grid gap-2">
          <Link href="/" className="flex min-h-12 items-center justify-center rounded-xl bg-brand px-4 font-semibold text-white">
            Check another fare
          </Link>
          <a href="/report" className="flex min-h-12 items-center justify-center rounded-xl border-2 border-line bg-surface px-4 font-semibold">
            Send another report
          </a>
        </div>
      </section>

      <NearbyReports origin={pickup} highlightId={newReportId} />
    </div>
  );
}
