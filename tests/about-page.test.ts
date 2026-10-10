import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AboutPage from "@/app/about/page";
import {
  COMMUNITY_BLEND,
  COMMUNITY_ESCALATION,
  DISTANCE,
  FAIR_RANGE,
  RATE_LIMITS,
  VERDICT_THRESHOLDS,
} from "@/lib/config";

// The About page must show the same numbers the scoring engine uses. If someone changes
// lib/config.ts, the page changes with it; this test fails if a number is ever hard-coded.
describe("/about renders the live config", () => {
  const html = renderToStaticMarkup(createElement(AboutPage))
    .replace(/<!-- -->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

  it.each([
    ["fair threshold", `up to ${VERDICT_THRESHOLDS.fairMax}×`],
    ["suspicious threshold", `above ${VERDICT_THRESHOLDS.suspiciousMax}×`],
    ["fair range", `expected × ${FAIR_RANGE.lowFactor} to expected × ${FAIR_RANGE.highFactor}, rounded to ₹${FAIR_RANGE.roundTo}`],
    ["blend weight", `w = min(${COMMUNITY_BLEND.maxWeight}, reports ÷ ${COMMUNITY_BLEND.weightDivisor})`],
    ["minimum samples", `at least ${COMMUNITY_BLEND.minSamples} reports`],
    ["escalation", `within ${COMMUNITY_ESCALATION.radiusMeters} m of your pickup in the last ${COMMUNITY_ESCALATION.windowDays} days`],
    ["distance fallback", `straight-line distance × ${DISTANCE.roadFactor}`],
    ["rate limits", `${RATE_LIMITS.fareChecksPerHour} checks and ${RATE_LIMITS.reportsPerHour} reports per hour`],
  ])("shows the %s", (_name, text) => {
    expect(html).toContain(text);
  });

  it("explains the demo-estimate honesty label and the known limitations", () => {
    expect(html).toContain("Demo estimate");
    expect(html).toMatch(/placeholder/i);
    expect(html).toMatch(/device ID can be faked/i);
    expect(html).toMatch(/small community sample/i);
  });
});
