import { describe, expect, it } from "vitest";
import { MemoryRateLimiter, rateLimitError, windowStart } from "@/lib/rate-limit";

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

describe("MemoryRateLimiter", () => {
  it("allows max hits per window per key, then frees up as hits age out", () => {
    const limiter = new MemoryRateLimiter(2, 1000);
    expect(limiter.hit("a", 0)).toBe(true);
    expect(limiter.hit("a", 100)).toBe(true);
    expect(limiter.hit("a", 200)).toBe(false);
    expect(limiter.hit("b", 200)).toBe(true); // other keys are independent
    expect(limiter.hit("a", 1001)).toBe(true); // the hit at 0 has aged out
  });
});

describe("windowStart", () => {
  it("is one hour before now", () => {
    expect(windowStart(new Date("2026-10-10T12:00:00Z")).toISOString()).toBe("2026-10-10T11:00:00.000Z");
  });
});
