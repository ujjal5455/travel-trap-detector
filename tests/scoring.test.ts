import { describe, expect, it } from "vitest";
import { articleForNumber } from "@/lib/labels";
import {
  median,
  raiseOneLevel,
  scoreFare,
  ScoringInputError,
  selectBenchmark,
  type ReportSample,
  type ScoreInput,
} from "@/lib/scoring";
import type { FareBenchmark, LatLng } from "@/lib/types";

// ---------------------------------------------------------------------------
// Fixtures

/** Builds an instant from an India-time clock reading on 2026-10-10. */
const ist = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 10, h, m) - 5.5 * 3600_000);
const NOW = ist(12);
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

const PICKUP: LatLng = { lat: 26.1823701, lng: 91.7501234 }; // Guwahati Railway Station
/** A point `m` metres north of the pickup. */
const north = (m: number) => ({ pickupLat: PICKUP.lat + m / 111_320, pickupLng: PICKUP.lng });

/** ₹10/km, ₹50 minimum, no base fare: 10 km → ₹100, which keeps ratios easy to read. */
const AUTO: FareBenchmark = {
  id: "b-auto",
  areaId: "test-area",
  serviceType: "auto",
  pricingUnit: "per_km",
  baseFare: 0,
  perKmRate: 10,
  minFare: 50,
  nightMultiplier: 1.5,
  nightStart: 22,
  nightEnd: 5,
  sessionRates: null,
  source: "demo_estimate",
  sourceNote: "Replace with official fare chart",
};

const GUIDE: FareBenchmark = {
  ...AUTO,
  id: "b-guide",
  serviceType: "guide",
  pricingUnit: "per_session",
  baseFare: null,
  perKmRate: null,
  minFare: null,
  nightMultiplier: 1,
  sessionRates: { half_day: 800, full_day: 1500 },
};

function input(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    serviceType: "auto",
    quotedPrice: 100,
    areaId: "test-area",
    pickup: PICKUP,
    distanceKm: 10,
    distanceMethod: "road",
    sessionType: null,
    tripTime: ist(12),
    now: NOW,
    benchmark: AUTO,
    communityReports: [],
    scamReports: [],
    ...overrides,
  };
}

function report(overrides: Partial<ReportSample> = {}): ReportSample {
  return {
    deviceId: "device-1",
    areaId: "test-area",
    serviceType: "auto",
    ...north(0),
    distanceKm: 10,
    sessionType: null,
    paidPrice: 200,
    isScam: false,
    scamTags: [],
    createdAt: daysAgo(10),
    ...overrides,
  };
}

const reports = (n: number, overrides: Partial<ReportSample> = {}) =>
  Array.from({ length: n }, (_, i) => report({ deviceId: `device-${i}`, ...overrides }));

const scam = (deviceId: string, overrides: Partial<ReportSample> = {}) =>
  report({ deviceId, isScam: true, paidPrice: null, scamTags: ["inflated_tourist_price"], ...north(100), ...overrides });

// ---------------------------------------------------------------------------

describe("verdict from the price ratio", () => {
  it.each([
    [110, "FAIR"],
    [140, "SUSPICIOUS"],
    [200, "HIGH_RISK"],
  ] as const)("quoted ₹%i against ₹100 expected → %s", (quoted, verdict) => {
    const v = scoreFare(input({ quotedPrice: quoted }));
    expect(v.expectedFare).toBe(100);
    expect(v.verdict).toBe(verdict);
  });

  it("a price below the expected fare is FAIR", () => {
    const v = scoreFare(input({ quotedPrice: 80 }));
    expect(v.verdict).toBe("FAIR");
    expect(v.reasons[1]).toBe("That is 20% below the expected fare.");
  });

  it("says 'about the same' when the quote matches the expected fare", () => {
    expect(scoreFare(input({ quotedPrice: 100 })).reasons[1]).toBe("That is about the same as the expected fare.");
    expect(scoreFare(input({ quotedPrice: 99.6 })).reasons[1]).toBe("That is about the same as the expected fare.");
  });

  it("reports the ratio rounded to 2 decimals", () => {
    expect(scoreFare(input({ quotedPrice: 123 })).ratio).toBe(1.23);
  });
});

describe("exact threshold boundaries", () => {
  it("ratio 1.20 is FAIR and just above is SUSPICIOUS", () => {
    expect(scoreFare(input({ quotedPrice: 120 })).verdict).toBe("FAIR");
    expect(scoreFare(input({ quotedPrice: 121 })).verdict).toBe("SUSPICIOUS");
  });

  it("ratio 1.60 is SUSPICIOUS and just above is HIGH_RISK", () => {
    expect(scoreFare(input({ quotedPrice: 160 })).verdict).toBe("SUSPICIOUS");
    expect(scoreFare(input({ quotedPrice: 161 })).verdict).toBe("HIGH_RISK");
  });

  it("is not thrown off by floating point (342 / 285 = 1.2)", () => {
    const b = { ...AUTO, perKmRate: 28.5 }; // 10 km → ₹285
    const v = scoreFare(input({ benchmark: b, quotedPrice: 342 }));
    expect(v.expectedFare).toBe(285);
    expect(v.verdict).toBe("FAIR");
  });

  it("keeps the percentage honest just above a threshold", () => {
    const b = { ...AUTO, perKmRate: 28.5 }; // ₹285
    const v = scoreFare(input({ benchmark: b, quotedPrice: 343 })); // ratio 1.2035
    expect(v.verdict).toBe("SUSPICIOUS");
    expect(v.reasons[1]).toBe("That is 20.4% above the expected fare, more than the 20% allowance.");
  });
});

describe("minimum fare", () => {
  it("applies to very short trips", () => {
    const v = scoreFare(input({ distanceKm: 2, quotedPrice: 50 })); // metered ₹20 < ₹50 minimum
    expect(v.expectedFare).toBe(50);
    expect(v.verdict).toBe("FAIR");
    expect(v.reasons).toContain("The minimum fare of ₹50 applies to short trips.");
  });

  it("doesn't apply once the metered fare is higher", () => {
    const v = scoreFare(input({ distanceKm: 6 }));
    expect(v.expectedFare).toBe(60);
    expect(v.reasons.some((r) => r.includes("minimum fare"))).toBe(false);
  });

  it("applies to zero-distance trips", () => {
    expect(scoreFare(input({ distanceKm: 0, quotedPrice: 50 })).expectedFare).toBe(50);
  });
});

describe("night multiplier (window 22:00–05:00 IST, crossing midnight)", () => {
  it.each([
    ["21:59", ist(21, 59), 100],
    ["22:00", ist(22, 0), 150],
    ["23:30", ist(23, 30), 150],
    ["00:15", ist(0, 15), 150],
    ["04:59", ist(4, 59), 150],
    ["05:00", ist(5, 0), 100],
    ["12:00", ist(12, 0), 100],
  ])("at %s the expected fare is ₹%#", (_label, tripTime, expected) => {
    expect(scoreFare(input({ tripTime })).expectedFare).toBe(expected);
  });

  it("explains the night rate when applied", () => {
    const v = scoreFare(input({ tripTime: ist(23), quotedPrice: 150 }));
    expect(v.verdict).toBe("FAIR");
    expect(v.reasons).toContain("Night rate applied: ×1.5 between 22:00 and 05:00.");
  });

  it("multiplies after the minimum fare", () => {
    expect(scoreFare(input({ distanceKm: 2, tripTime: ist(23) })).expectedFare).toBe(75);
  });

  it("works with a window inside one day", () => {
    const b = { ...AUTO, nightStart: 1, nightEnd: 4 };
    expect(scoreFare(input({ benchmark: b, tripTime: ist(2) })).expectedFare).toBe(150);
    expect(scoreFare(input({ benchmark: b, tripTime: ist(23) })).expectedFare).toBe(100);
  });

  it("does nothing when the multiplier is 1", () => {
    const v = scoreFare(input({ benchmark: { ...AUTO, nightMultiplier: 1 }, tripTime: ist(23) }));
    expect(v.expectedFare).toBe(100);
    expect(v.reasons.some((r) => r.includes("Night rate"))).toBe(false);
  });
});

describe("community blend", () => {
  // Benchmark ₹100; every report paid ₹200 for the same distance, so the median is ₹200.
  it("is ignored below 5 samples", () => {
    const v = scoreFare(input({ communityReports: reports(4) }));
    expect(v.expectedFare).toBe(100);
    expect(v.communitySampleSize).toBe(4);
    expect(v.reasons).toContain("Only 4 similar traveller reports so far (5 needed), so the rate card alone is used.");
  });

  it.each([
    [5, 0.25, 125],
    [10, 0.5, 150],
    [30, 0.5, 150],
  ])("with %i samples uses weight %f → ₹%i", (n, _weight, expected) => {
    const v = scoreFare(input({ communityReports: reports(n) }));
    expect(v.expectedFare).toBe(expected);
    expect(v.communitySampleSize).toBe(n);
  });

  it("uses the median, not the mean", () => {
    const paid = [100, 100, 100, 1000, 1000];
    const v = scoreFare(input({ communityReports: paid.map((p, i) => report({ deviceId: `d${i}`, paidPrice: p })) }));
    expect(v.expectedFare).toBe(100); // median ₹100 → 0.75 × 100 + 0.25 × 100
  });

  it("explains the blend", () => {
    const v = scoreFare(input({ communityReports: reports(8) }));
    expect(v.reasons).toContain("Expected fare blends the rate card with 8 recent traveller reports for similar trips (median ₹200).");
  });

  it("only counts recent, non-scam reports for the same area and service", () => {
    const noise = [
      report({ isScam: true }),
      report({ areaId: "elsewhere" }),
      report({ serviceType: "taxi" }),
      report({ createdAt: daysAgo(181) }),
      report({ paidPrice: null }),
    ];
    const v = scoreFare(input({ communityReports: [...reports(4), ...noise] }));
    expect(v.communitySampleSize).toBe(4);
    expect(v.expectedFare).toBe(100);
  });

  it("is not used outside every area (no 'same area' to compare)", () => {
    const v = scoreFare(input({ areaId: null, communityReports: reports(10, { areaId: null }) }));
    expect(v.communitySampleSize).toBe(0);
  });
});

describe("distance scaling of community samples", () => {
  it("scales each paid price to this trip's distance", () => {
    // 8.5 km for ₹170 → ₹200 for 10 km. Five of them → median ₹200, weight 0.25 → ₹125.
    const v = scoreFare(input({ communityReports: reports(5, { distanceKm: 8.5, paidPrice: 170 }) }));
    expect(v.expectedFare).toBe(125);
  });

  it("includes reports exactly ±20% from the trip distance and excludes ones further away", () => {
    const inside = [report({ distanceKm: 8 }), report({ distanceKm: 12 })];
    const outside = [report({ distanceKm: 7.9 }), report({ distanceKm: 12.1 })];
    expect(scoreFare(input({ communityReports: [...inside, ...outside] })).communitySampleSize).toBe(2);
  });
});

describe("community escalation", () => {
  it("3 scam reports from 3 devices raise FAIR to SUSPICIOUS", () => {
    const v = scoreFare(input({ quotedPrice: 100, scamReports: [scam("a"), scam("b"), scam("c")] }));
    expect(v.verdict).toBe("SUSPICIOUS");
    expect(v.nearbyScam).toEqual({ count: 3, distinctDevices: 3, topTags: ["inflated_tourist_price"] });
    expect(v.reasons.at(-1)).toBe(
      "Raised from FAIR to SUSPICIOUS: 3 scam reports from 3 different travellers within 500 m of this pickup in the last 90 days. Most reported: inflated tourist price.",
    );
  });

  it("raises SUSPICIOUS to HIGH_RISK", () => {
    const v = scoreFare(input({ quotedPrice: 140, scamReports: [scam("a"), scam("b"), scam("c")] }));
    expect(v.verdict).toBe("HIGH_RISK");
  });

  it("3 reports from one device do not escalate", () => {
    const v = scoreFare(input({ scamReports: [scam("a"), scam("a"), scam("a")] }));
    expect(v.verdict).toBe("FAIR");
    expect(v.nearbyScam.distinctDevices).toBe(1);
    expect(v.reasons.at(-1)).toBe(
      "3 scam reports near this pickup in the last 90 days, not enough independent reports to change the verdict.",
    );
  });

  it("never goes beyond HIGH_RISK", () => {
    const v = scoreFare(input({ quotedPrice: 300, scamReports: [scam("a"), scam("b"), scam("c"), scam("d")] }));
    expect(v.verdict).toBe("HIGH_RISK");
    expect(v.reasons.at(-1)).toMatch(/^Also, 4 scam reports from 4 different travellers/);
  });

  it("ignores reports further than 500 m or older than 90 days", () => {
    const v = scoreFare(
      input({ scamReports: [scam("a"), scam("b"), scam("c", north(600)), scam("d", { createdAt: daysAgo(91) })] }),
    );
    expect(v.verdict).toBe("FAIR");
    expect(v.nearbyScam.count).toBe(2);
  });

  it("ranks the top tags by frequency", () => {
    const v = scoreFare(
      input({
        scamReports: [
          scam("a", { scamTags: ["meter_refusal", "luggage_surcharge"] }),
          scam("b", { scamTags: ["meter_refusal"] }),
          scam("c", { scamTags: ["wrong_change", "luggage_surcharge"] }),
          scam("d", { scamTags: ["meter_refusal", "hidden_charges"] }),
        ],
      }),
    );
    expect(v.nearbyScam.topTags).toEqual(["meter_refusal", "luggage_surcharge", "hidden_charges"]);
  });
});

describe("guide pricing", () => {
  const guide = (o: Partial<ScoreInput> = {}) =>
    input({ serviceType: "guide", benchmark: GUIDE, distanceKm: null, distanceMethod: null, sessionType: "full_day", ...o });

  it("uses the session rate for the session type", () => {
    expect(scoreFare(guide({ quotedPrice: 1500 })).expectedFare).toBe(1500);
    expect(scoreFare(guide({ sessionType: "half_day", quotedPrice: 800 })).expectedFare).toBe(800);
  });

  it("has no distance and no night rate", () => {
    const v = scoreFare(guide({ quotedPrice: 1500, tripTime: ist(23) }));
    expect(v.distanceKm).toBeNull();
    expect(v.distanceMethod).toBeNull();
    expect(v.expectedFare).toBe(1500);
  });

  it("names the session in the reason", () => {
    expect(scoreFare(guide({ quotedPrice: 2550 })).reasons[0]).toBe(
      "Quoted ₹2,550 is 1.7× the expected ₹1,500 for a full-day guide.",
    );
  });

  it("blends community reports of the same session type without distance scaling", () => {
    const same = reports(5, { serviceType: "guide", sessionType: "full_day", distanceKm: null, paidPrice: 2000 });
    const other = reports(5, { serviceType: "guide", sessionType: "half_day", distanceKm: null, paidPrice: 9000 });
    const v = scoreFare(guide({ communityReports: [...same, ...other] }));
    expect(v.communitySampleSize).toBe(5);
    expect(v.expectedFare).toBe(1625); // 0.75 × 1500 + 0.25 × 2000
  });
});

describe("fair range", () => {
  it("is [expected × 0.90, expected × 1.15] rounded to the nearest ₹10", () => {
    const b = { ...AUTO, perKmRate: 28.5 }; // ₹285 → 256.5, 327.75
    expect(scoreFare(input({ benchmark: b })).fairRange).toEqual({ min: 260, max: 330 });
  });

  it("rounds another value correctly", () => {
    const b = { ...AUTO, baseFare: 40, perKmRate: 18 }; // 6.8 km → ₹162.4 → ₹162 → 145.8, 186.3
    expect(scoreFare(input({ benchmark: b, distanceKm: 6.8 })).fairRange).toEqual({ min: 150, max: 190 });
  });
});

describe("confidence", () => {
  it("HIGH with an area benchmark and at least 5 community samples", () => {
    expect(scoreFare(input({ communityReports: reports(5) })).confidence).toBe("HIGH");
  });

  it("MEDIUM with an area benchmark only", () => {
    expect(scoreFare(input({ communityReports: reports(4) })).confidence).toBe("MEDIUM");
  });

  it("LOW with the regional default, even with community data", () => {
    const regional = { ...AUTO, areaId: null };
    const v = scoreFare(input({ benchmark: regional, communityReports: reports(10) }));
    expect(v.confidence).toBe("LOW");
    expect(v.reasons).toContain("There is no local rate for this place, so the regional default rate is used.");
  });
});

describe("reasons", () => {
  it("state the ratio, expected fare and distance in readable form", () => {
    // ₹100 + ₹29.8/km × 6.2 km = ₹284.76 → ₹285
    const b = { ...AUTO, baseFare: 100, perKmRate: 29.8 };
    const v = scoreFare(input({ benchmark: b, distanceKm: 6.2, quotedPrice: 600 }));
    expect(v.reasons[0]).toBe("Quoted ₹600 is 2.1× the expected ₹285 for a 6.2 km auto ride.");
    expect(v.reasons[1]).toBe("That is 111% above the expected fare, more than 60% over.");
  });

  it("use Indian digit grouping and 'an' where spoken English needs it", () => {
    const b = { ...AUTO, serviceType: "taxi" as const, perKmRate: 150 };
    const v = scoreFare(input({ serviceType: "taxi", benchmark: b, distanceKm: 8, quotedPrice: 1500 }));
    expect(v.reasons[0]).toBe("Quoted ₹1,500 is 1.3× the expected ₹1,200 for an 8.0 km taxi ride.");
  });

  it("flag an estimated distance", () => {
    const v = scoreFare(input({ distanceMethod: "estimate" }));
    expect(v.reasons).toContain("Road distance was unavailable, so the distance is an estimate (straight line × 1.3).");
  });

  it("pass the benchmark source through for the badge", () => {
    expect(scoreFare(input()).benchmarkSource).toBe("demo_estimate");
  });
});

describe("selectBenchmark", () => {
  const regionalAuto = { ...AUTO, id: "r-auto", areaId: null };
  const all = [AUTO, regionalAuto, GUIDE];

  it("prefers the area's own benchmark", () => {
    expect(selectBenchmark(all, "test-area", "auto").id).toBe("b-auto");
  });

  it("falls back to the regional default when the area has none", () => {
    expect(selectBenchmark(all, "other-area", "auto").id).toBe("r-auto");
  });

  it("uses the regional default outside every area", () => {
    expect(selectBenchmark(all, null, "auto").id).toBe("r-auto");
  });

  it("throws when nothing matches", () => {
    expect(() => selectBenchmark(all, null, "taxi")).toThrow(ScoringInputError);
  });
});

describe("input validation", () => {
  it("rejects a missing distance for per-km services", () => {
    expect(() => scoreFare(input({ distanceKm: null }))).toThrow(/distanceKm/);
  });

  it("rejects a guide without a session type", () => {
    expect(() =>
      scoreFare(input({ serviceType: "guide", benchmark: GUIDE, distanceKm: null, sessionType: null })),
    ).toThrow(/sessionType/);
  });

  it("rejects a non-positive quote and a mismatched benchmark", () => {
    expect(() => scoreFare(input({ quotedPrice: 0 }))).toThrow(/quotedPrice/);
    expect(() => scoreFare(input({ serviceType: "taxi" }))).toThrow(/different service/);
  });
});

describe("helpers", () => {
  it("median handles odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("raiseOneLevel caps at HIGH_RISK", () => {
    expect(raiseOneLevel("FAIR")).toBe("SUSPICIOUS");
    expect(raiseOneLevel("SUSPICIOUS")).toBe("HIGH_RISK");
    expect(raiseOneLevel("HIGH_RISK")).toBe("HIGH_RISK");
  });

  it("articleForNumber", () => {
    expect(articleForNumber("8.0 km")).toBe("an");
    expect(articleForNumber("11.6 km")).toBe("an");
    expect(articleForNumber("18 km")).toBe("an");
    expect(articleForNumber("80 km")).toBe("an");
    expect(articleForNumber("110 km")).toBe("a");
    expect(articleForNumber("1.8 km")).toBe("a");
    expect(articleForNumber("6.2 km")).toBe("a");
  });
});
