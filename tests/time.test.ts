import { describe, expect, it } from "vitest";
import { formatHour, isNightHour, isNightTime, localHour } from "@/lib/time";

/** Builds an instant from an India-time clock reading (IST = UTC+05:30, no DST). */
const ist = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 10, h, m) - 5.5 * 3600_000);

describe("localHour", () => {
  it("reads the hour in India time regardless of the server zone", () => {
    expect(localHour(new Date("2026-10-10T17:30:00Z"))).toBe(23);
    expect(localHour(new Date("2026-10-10T18:30:00Z"))).toBe(0);
    expect(localHour(ist(4, 59))).toBe(4);
  });
});

describe("isNightHour", () => {
  it("handles a window that crosses midnight (22 → 5)", () => {
    expect(isNightHour(21, 22, 5)).toBe(false);
    expect(isNightHour(22, 22, 5)).toBe(true);
    expect(isNightHour(0, 22, 5)).toBe(true);
    expect(isNightHour(4, 22, 5)).toBe(true);
    expect(isNightHour(5, 22, 5)).toBe(false);
    expect(isNightHour(12, 22, 5)).toBe(false);
  });

  it("handles a window within one day (1 → 4)", () => {
    expect(isNightHour(0, 1, 4)).toBe(false);
    expect(isNightHour(1, 1, 4)).toBe(true);
    expect(isNightHour(3, 1, 4)).toBe(true);
    expect(isNightHour(4, 1, 4)).toBe(false);
    expect(isNightHour(23, 1, 4)).toBe(false);
  });

  it("treats start === end as no night window", () => {
    expect(isNightHour(22, 22, 22)).toBe(false);
  });
});

describe("isNightTime", () => {
  it("uses minutes correctly at the edges", () => {
    expect(isNightTime(ist(21, 59), 22, 5)).toBe(false);
    expect(isNightTime(ist(22, 0), 22, 5)).toBe(true);
    expect(isNightTime(ist(4, 59), 22, 5)).toBe(true);
    expect(isNightTime(ist(5, 0), 22, 5)).toBe(false);
  });
});

describe("formatHour", () => {
  it("pads to HH:00", () => {
    expect(formatHour(5)).toBe("05:00");
    expect(formatHour(22)).toBe("22:00");
  });
});
