import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  COMMUNITY_BLEND,
  COMMUNITY_ESCALATION,
  DISTANCE,
  EXPLANATION,
  FAIR_RANGE,
  HOTSPOTS,
  NIGHT_DEFAULTS,
  RATE_LIMITS,
  REPORTS,
  VERDICT_THRESHOLDS,
} from "@/lib/config";
import { formatHour } from "@/lib/time";

export const metadata: Metadata = {
  title: "How it works",
  description: "How Travel Trap Detector scores a fare, where the numbers come from, and what it can't know.",
};

// Every number on this page is read from lib/config.ts, the same values the scoring engine uses,
// so the explanation can never drift from the code.
const pct = (factor: number) => `${Math.round((factor - 1) * 100)}%`;
const x = (n: number) => `${n}×`;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h2 id={id} className="text-lg font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-canvas px-3 py-2 font-mono text-sm">{children}</p>;
}

export default function AboutPage() {
  const night = `${formatHour(NIGHT_DEFAULTS.start)}–${formatHour(NIGHT_DEFAULTS.end)}`;
  return (
    <main>
      <PageHeader title="How it works" subtitle="How we score a fare, where the numbers come from, and what we can't know." />

      <div className="space-y-8 px-4 pb-10 text-sm leading-relaxed">
        <Section id="what" title="In one minute">
          <p>
            You tell us the trip and the price you were quoted. We work out what the trip should cost from a rate card,
            adjust it with what other travellers actually paid, and compare. Every verdict lists its reasons, so you can
            see exactly why. Nothing is a black-box score.
          </p>
        </Section>

        <Section id="steps" title="How a fare is checked">
          <ol className="list-decimal space-y-4 pl-5">
            <li>
              <strong>Distance.</strong> We ask OpenRouteService for the road distance. If that isn&apos;t available (or
              you&apos;re offline) we use the straight-line distance × {DISTANCE.roadFactor} and say it&apos;s an estimate.
            </li>
            <li>
              <strong>Rate card.</strong> Each area has a rate for each kind of ride:
              <Formula>expected = max(minimum fare, base fare + per-km rate × km)</Formula>
              Between {night} (India time) it&apos;s multiplied by that area&apos;s night rate, for example ×1.25. Guides
              have a fixed half-day or full-day rate instead.
            </li>
            <li>
              <strong>What travellers paid.</strong> If there are at least {COMMUNITY_BLEND.minSamples} reports of similar
              trips (same area and ride type, distance within ±{Math.round(COMMUNITY_BLEND.distanceTolerance * 100)}%, last{" "}
              {COMMUNITY_BLEND.windowDays} days, not scam reports), each is scaled to your distance and their median is mixed in:
              <Formula>
                expected = (1 − w) × rate card + w × median paid, where w = min({COMMUNITY_BLEND.maxWeight}, reports ÷{" "}
                {COMMUNITY_BLEND.weightDivisor})
              </Formula>
              With fewer reports we use the rate card alone, because a handful of reports could mislead.
            </li>
            <li>
              <strong>Compare.</strong> We divide the quote by the expected fare:
              <table className="mt-2 w-full border-collapse text-left">
                <caption className="sr-only">Verdict thresholds</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="py-1 pr-2">Quote ÷ expected</th>
                    <th scope="col" className="py-1">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-line">
                    <td className="py-1 pr-2">up to {x(VERDICT_THRESHOLDS.fairMax)} (≤ {pct(VERDICT_THRESHOLDS.fairMax)} more)</td>
                    <td className="py-1 font-semibold text-fair">✓ Fair</td>
                  </tr>
                  <tr className="border-b border-line">
                    <td className="py-1 pr-2">
                      up to {x(VERDICT_THRESHOLDS.suspiciousMax)} (≤ {pct(VERDICT_THRESHOLDS.suspiciousMax)} more)
                    </td>
                    <td className="py-1 font-semibold text-suspicious">⚠ Suspicious</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-2">above {x(VERDICT_THRESHOLDS.suspiciousMax)}</td>
                    <td className="py-1 font-semibold text-risk">⛔ High risk</td>
                  </tr>
                </tbody>
              </table>
            </li>
            <li>
              <strong>Community warning.</strong> If at least {COMMUNITY_ESCALATION.minReports} scam reports from at least{" "}
              {COMMUNITY_ESCALATION.minDistinctDevices} different travellers were made within{" "}
              {COMMUNITY_ESCALATION.radiusMeters} m of your pickup in the last {COMMUNITY_ESCALATION.windowDays} days, the
              verdict goes up one level (never above High risk) and the card says why. Requiring different travellers stops
              one person from flagging a place alone. These same places appear as hotspots on the map (cells of{" "}
              {HOTSPOTS.cellRadiusMeters} m radius).
            </li>
            <li>
              <strong>Fair range.</strong> The range you can negotiate towards:
              <Formula>
                expected × {FAIR_RANGE.lowFactor} to expected × {FAIR_RANGE.highFactor}, rounded to ₹{FAIR_RANGE.roundTo}
              </Formula>
            </li>
            <li>
              <strong>Confidence.</strong> <em>High</em>: a local rate card plus {COMMUNITY_BLEND.minSamples}+ traveller
              reports. <em>Medium</em>: a local rate card only. <em>Low</em>: outside our listed areas, so a general North
              East rate is used.
            </li>
            <li>
              <strong>Explanation.</strong> A free AI model rewrites the reasons in friendly words. It may only repeat numbers
              that are already in the verdict: we check every number it writes and use a fixed template instead if any
              number is new, if it uses accusing words, or if it takes longer than {EXPLANATION.timeoutMs / 1000} seconds.
            </li>
          </ol>
        </Section>

        <Section id="sources" title="Where the numbers come from">
          <ul className="space-y-2">
            <li>
              <span className="mr-1 rounded-full border border-suspicious/40 bg-suspicious-soft px-2 py-0.5 text-xs font-medium text-suspicious">
                Demo estimate
              </span>
              <strong>Rate cards.</strong> In this prototype every rate is a <strong>placeholder</strong> we chose to be
              plausible, not an official fare. The badge on each verdict says so. When a rate is replaced with an official
              chart, the badge changes to &ldquo;Official fare chart&rdquo; and names the source.
            </li>
            <li>
              <strong>Traveller reports.</strong> What people tell us they paid, plus 100 clearly marked synthetic reports
              used to demonstrate the community features.
            </li>
            <li>
              <strong>Places and maps.</strong> © OpenStreetMap contributors (via Nominatim search and map tiles).
            </li>
            <li>
              <strong>Road distance.</strong> OpenRouteService.
            </li>
            <li>
              <strong>Explanations.</strong> A free model on Groq, checked as described above.
            </li>
          </ul>
        </Section>

        <Section id="privacy" title="Privacy">
          <ul className="list-disc space-y-1 pl-5">
            <li>We flag places and patterns, never individual people. Phone numbers and vehicle numbers are removed from report text automatically.</li>
            <li>Evidence photos are stored privately and never shown to anyone; we only show &ldquo;evidence attached&rdquo;. Location data inside photos is stripped on your phone.</li>
            <li>No accounts. Your phone gets a random ID so we can limit spam ({RATE_LIMITS.fareChecksPerHour} checks and {RATE_LIMITS.reportsPerHour} reports per hour).</li>
            <li>If you let the map use your location, it stays on your phone.</li>
          </ul>
        </Section>

        <Section id="limits" title="What we can't know (yet)">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Placeholder rates.</strong> Until official fare charts are added, verdicts are a guide, not a ruling.
            </li>
            <li>
              <strong>The device ID can be faked.</strong> Someone determined could pose as several travellers. Rate limits and
              the {COMMUNITY_ESCALATION.minDistinctDevices}-traveller rule reduce, but don&apos;t remove, this risk.
            </li>
            <li>
              <strong>Small community sample.</strong> Most places have few real reports so far, so most checks rely on the
              rate card alone.
            </li>
            <li>
              <strong>Hill roads.</strong> When road distance is unavailable, the straight-line estimate can be about half the
              real distance in the hills (Gangtok, Tawang), which makes fair quotes look high.
            </li>
            <li>
              <strong>Route-based fares.</strong> Many shared taxis charge a fixed fare per seat per route; our per-km model
              only approximates these.
            </li>
            <li>
              <strong>Offline checks</strong> use saved rates only, with no traveller reports or warnings.
            </li>
            <li>
              <strong>Translations</strong> on the &ldquo;Show the driver&rdquo; card are first drafts awaiting native-speaker review.
            </li>
            <li>
              <strong>Old reports fade out.</strong> Only the last {COMMUNITY_BLEND.windowDays} days of fare reports and{" "}
              {COMMUNITY_ESCALATION.windowDays} days of scam reports count, and the nearby list shows the last{" "}
              {REPORTS.nearbyWindowDays} days.
            </li>
          </ul>
        </Section>
      </div>
    </main>
  );
}
