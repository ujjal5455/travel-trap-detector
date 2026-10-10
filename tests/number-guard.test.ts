import { describe, expect, it } from "vitest";
import { allowedNumbers, extractNumbers, isAllowed, unexpectedNumbers } from "@/lib/number-guard";

describe("extractNumbers", () => {
  it("reads rupee amounts with Indian and Western grouping", () => {
    expect(extractNumbers("₹1,00,000 and ₹1,500 and ₹85")).toEqual([100000, 1500, 85]);
  });

  it("reads decimals, ratios, percentages and distances", () => {
    expect(extractNumbers("2.1× the fare, 102% above, 6.8 km")).toEqual([2.1, 102, 6.8]);
  });

  it("doesn't glue a list together or swallow sentence punctuation", () => {
    expect(extractNumbers("between ₹150, ₹190. Then 3.")).toEqual([150, 190, 3]);
  });

  it("splits clock times", () => {
    expect(extractNumbers("from 22:00 to 05:00")).toEqual([22, 0, 5, 0]);
  });

  it("returns nothing for text without digits", () => {
    expect(extractNumbers("This price looks fair.")).toEqual([]);
  });
});

describe("isAllowed (rounding)", () => {
  const allowed = new Set([163, 2.02, 6.8, 1.04]);

  it("accepts exact values", () => {
    expect(isAllowed(163, allowed)).toBe(true);
    expect(isAllowed(6.8, allowed)).toBe(true);
  });

  it("accepts values rounded to 0, 1 or 2 decimals or to the nearest 10", () => {
    expect(isAllowed(2, allowed)).toBe(true); // 2.02 → 2
    expect(isAllowed(2.0, allowed)).toBe(true);
    expect(isAllowed(7, allowed)).toBe(true); // 6.8 → 7
    expect(isAllowed(160, allowed)).toBe(true); // 163 → 160
    expect(isAllowed(1, allowed)).toBe(true); // 1.04 → 1
  });

  it("rejects values that are not a rounding of any fact", () => {
    expect(isAllowed(170, allowed)).toBe(false);
    expect(isAllowed(2.5, allowed)).toBe(false);
    expect(isAllowed(3, allowed)).toBe(false);
  });
});

describe("unexpectedNumbers", () => {
  const facts = {
    quotedPrice: 330,
    expectedFare: 163,
    ratio: 2.02,
    fairRange: { min: 150, max: 190 },
    distanceKm: 6.8,
    nearbyProblemReports: { count: 9, differentTravellers: 4 },
    reasons: ["That is 102% above the expected fare, more than 60% over."],
  };

  it("collects numbers from strings inside the facts too", () => {
    expect(allowedNumbers(facts).has(102)).toBe(true);
    expect(allowedNumbers(facts).has(60)).toBe(true);
  });

  it("passes a faithful response", () => {
    const text =
      "₹330 may be overpriced: it is about 2× the expected ₹163 for this 6.8 km ride. A fair price is ₹150–₹190. 9 reports from 4 travellers mention problems nearby.";
    expect(unexpectedNumbers(text, facts)).toEqual([]);
  });

  it("catches an invented number", () => {
    const text = "₹330 may be overpriced. Most drivers here charge ₹250 for this trip.";
    expect(unexpectedNumbers(text, facts)).toEqual([250]);
  });

  it("catches a miscounted fact and an invented percentage", () => {
    expect(unexpectedNumbers("12 travellers reported problems; that is 50% more.", facts)).toEqual([12, 50]);
  });

  it("catches a number hidden in Indian grouping", () => {
    expect(unexpectedNumbers("Expect to pay ₹1,630.", facts)).toEqual([1630]);
  });
});
