import { describe, expect, it } from "vitest";
import { formatINR, formatKm, formatRatio, roundToNearest } from "@/lib/format";

describe("formatINR", () => {
  it("formats whole rupees with the rupee sign", () => {
    expect(formatINR(285)).toBe("₹285");
  });

  it("uses Indian digit grouping", () => {
    expect(formatINR(1200)).toBe("₹1,200");
    expect(formatINR(100000)).toBe("₹1,00,000");
  });

  it("rounds paise away", () => {
    expect(formatINR(284.6)).toBe("₹285");
  });
});

describe("roundToNearest", () => {
  it("rounds to the nearest 10", () => {
    expect(roundToNearest(256.5, 10)).toBe(260);
    expect(roundToNearest(254.9, 10)).toBe(250);
    expect(roundToNearest(255, 10)).toBe(260);
  });
});

describe("formatRatio / formatKm", () => {
  it("uses one decimal place", () => {
    expect(formatRatio(2.08)).toBe("2.1×");
    expect(formatKm(6.24)).toBe("6.2 km");
  });
});
