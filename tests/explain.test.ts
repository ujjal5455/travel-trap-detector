import { describe, expect, it } from "vitest";
import { templateExplanation } from "@/lib/explain";
import type { FareVerdict } from "@/lib/types";

const base: FareVerdict = {
  verdict: "FAIR",
  ratio: 1.05,
  expectedFare: 163,
  fairRange: { min: 150, max: 190 },
  distanceKm: 6.8,
  distanceMethod: "road",
  benchmarkSource: "demo_estimate",
  communitySampleSize: 7,
  nearbyScam: { count: 0, distinctDevices: 0, topTags: [] },
  confidence: "HIGH",
  reasons: ["Quoted ₹170 is 1.0× the expected ₹163 for a 6.8 km auto ride."],
};

const sentences = (t: string) => t.split(/(?<=\.)\s+/).filter(Boolean);
/** Numbers that appear in the text, ignoring thousands separators. */
const numbers = (t: string) => (t.replace(/(\d),(\d)/g, "$1$2").match(/\d+(\.\d+)?/g) ?? []).map(Number);

describe("templateExplanation", () => {
  it("FAIR: says it looks fair and gives the range", () => {
    const e = templateExplanation(base, 170);
    expect(e.source).toBe("template");
    expect(e.text).toBe("₹170 looks fair: it is close to the expected ₹163 for this trip. A fair price here is about ₹150–₹190.");
    expect(e.tip.length).toBeGreaterThan(10);
  });

  it("SUSPICIOUS by price: suggests asking for the usual fare", () => {
    const e = templateExplanation({ ...base, verdict: "SUSPICIOUS", ratio: 1.4 }, 230);
    expect(e.text).toContain("may be on the high side");
    expect(e.tip).toContain("₹190");
  });

  it("SUSPICIOUS by escalation: mentions other travellers, not the price", () => {
    const v: FareVerdict = {
      ...base,
      verdict: "SUSPICIOUS",
      nearbyScam: { count: 9, distinctDevices: 4, topTags: ["inflated_tourist_price"] },
      reasons: [...base.reasons, "Raised from FAIR to SUSPICIOUS: 9 scam reports ..."],
    };
    expect(templateExplanation(v, 170).text).toContain("other travellers have reported problems near this pickup");
  });

  it("HIGH_RISK: says 'may be overpriced' with the ratio, and adds the nearby-reports note", () => {
    const v: FareVerdict = {
      ...base,
      verdict: "HIGH_RISK",
      ratio: 2.09,
      nearbyScam: { count: 9, distinctDevices: 4, topTags: [] },
    };
    const e = templateExplanation(v, 340);
    expect(e.text).toContain("₹340 may be overpriced: it is 2.1× the expected ₹163.");
    expect(e.text).toContain("Other travellers have also reported problems near this pickup recently.");
  });

  it("HIGH_RISK raised by escalation still mentions other travellers", () => {
    const v: FareVerdict = {
      ...base,
      verdict: "HIGH_RISK",
      ratio: 1.4,
      nearbyScam: { count: 9, distinctDevices: 4, topTags: [] },
      reasons: [...base.reasons, "Raised from SUSPICIOUS to HIGH_RISK: 9 scam reports ..."],
    };
    expect(templateExplanation(v, 230).text).toContain("Other travellers have also reported problems");
  });

  it("FAIR well below the expected fare doesn't claim it is 'close'", () => {
    const e = templateExplanation({ ...base, ratio: 0.5 }, 80);
    expect(e.text).toContain("₹80 is below the expected ₹163 for this trip, so it looks fair.");
  });

  it("LOW confidence: says it is a rough guide", () => {
    expect(templateExplanation({ ...base, confidence: "LOW" }, 170).text).toContain("rough guide");
  });

  it("never uses accusing words and stays within 2–3 sentences", () => {
    for (const verdict of ["FAIR", "SUSPICIOUS", "HIGH_RISK"] as const) {
      for (const confidence of ["HIGH", "LOW"] as const) {
        const e = templateExplanation({ ...base, verdict, confidence, ratio: 2 }, 300);
        expect(`${e.text} ${e.tip}`).not.toMatch(/scam|cheat|fraud|illegal|police|driver is/i);
        expect(sentences(e.text).length).toBeGreaterThanOrEqual(2);
        expect(sentences(e.text).length).toBeLessThanOrEqual(3);
      }
    }
  });

  it("only uses numbers that are in the verdict or the quote", () => {
    const v: FareVerdict = { ...base, verdict: "HIGH_RISK", ratio: 2.09 };
    const allowed = new Set([340, 163, 150, 190, 2.1, 2.09]);
    const e = templateExplanation(v, 340);
    for (const n of numbers(`${e.text} ${e.tip}`)) expect(allowed.has(n)).toBe(true);
  });
});
