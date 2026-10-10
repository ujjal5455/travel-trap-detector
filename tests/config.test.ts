import { describe, expect, it } from "vitest";
import { COMMUNITY_BLEND, FAIR_RANGE, NIGHT_DEFAULTS, VERDICT_THRESHOLDS } from "@/lib/config";

// Guards against an edit to lib/config.ts that would make the scoring rules contradict themselves.
describe("config sanity", () => {
  it("verdict thresholds are ordered", () => {
    expect(VERDICT_THRESHOLDS.fairMax).toBeGreaterThan(1);
    expect(VERDICT_THRESHOLDS.suspiciousMax).toBeGreaterThan(VERDICT_THRESHOLDS.fairMax);
  });

  it("fair range brackets the expected fare", () => {
    expect(FAIR_RANGE.lowFactor).toBeLessThan(1);
    expect(FAIR_RANGE.highFactor).toBeGreaterThan(1);
    expect(FAIR_RANGE.highFactor).toBeLessThanOrEqual(VERDICT_THRESHOLDS.fairMax);
  });

  it("community weight never exceeds one half", () => {
    expect(COMMUNITY_BLEND.maxWeight).toBeLessThanOrEqual(0.5);
    expect(COMMUNITY_BLEND.minSamples / COMMUNITY_BLEND.weightDivisor).toBeLessThanOrEqual(COMMUNITY_BLEND.maxWeight);
  });

  it("night hours are valid clock hours", () => {
    for (const h of [NIGHT_DEFAULTS.start, NIGHT_DEFAULTS.end]) {
      expect(Number.isInteger(h) && h >= 0 && h <= 23).toBe(true);
    }
  });
});
