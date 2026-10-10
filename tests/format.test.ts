import { describe, expect, it } from "vitest";
import { formatINR, formatKm, formatMeters, formatRatio, formatTimeAgo, roundToNearest, sourceLink } from "@/lib/format";

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

describe("formatTimeAgo", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it.each([
    ["2026-10-10T08:00:00Z", "today"],
    ["2026-10-09T08:00:00Z", "yesterday"],
    ["2026-10-05T12:00:00Z", "5 days ago"],
    ["2026-09-20T12:00:00Z", "2 weeks ago"],
    ["2026-06-10T12:00:00Z", "4 months ago"],
  ])("%s → %s", (iso, expected) => {
    expect(formatTimeAgo(iso, now)).toBe(expected);
  });
});

describe("formatMeters", () => {
  it("uses metres below 1 km and km above", () => {
    expect(formatMeters(343)).toBe("340 m");
    expect(formatMeters(1234)).toBe("1.2 km");
  });
});

describe("formatRatio / formatKm", () => {
  it("uses one decimal place", () => {
    expect(formatRatio(2.08)).toBe("2.1×");
    expect(formatKm(6.24)).toBe("6.2 km");
  });
});

describe("sourceLink", () => {
  it("gives the link and a short host name for https sources", () => {
    expect(sourceLink("https://www.aai.aero/en/airports/transport-details/guwahati/Taxi")).toEqual({
      href: "https://www.aai.aero/en/airports/transport-details/guwahati/Taxi",
      host: "aai.aero",
    });
  });

  it("rejects anything that isn't an https URL", () => {
    for (const bad of [null, undefined, "", "not a url", "http://aai.aero", "javascript:alert(1)", "data:text/html,hi"]) {
      expect(sourceLink(bad)).toBeNull();
    }
  });
});
