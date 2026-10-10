import { describe, expect, it } from "vitest";
import { rateLimitError, windowStart } from "@/lib/rate-limit";

describe("rateLimitError", () => {
  it("allows up to 30 fare checks per hour", () => {
    expect(rateLimitError("fareCheck", 29)).toBeNull();
    expect(rateLimitError("fareCheck", 30)).toMatch(/limit of 30 fare checks per hour/);
  });

  it("allows up to 5 reports per hour", () => {
    expect(rateLimitError("report", 4)).toBeNull();
    expect(rateLimitError("report", 5)).toMatch(/limit of 5 reports per hour/);
  });
});

describe("windowStart", () => {
  it("is one hour before now", () => {
    expect(windowStart(new Date("2026-10-10T12:00:00Z")).toISOString()).toBe("2026-10-10T11:00:00.000Z");
  });
});
