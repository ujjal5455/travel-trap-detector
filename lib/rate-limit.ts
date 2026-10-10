// Per-device hourly limits (docs/SPEC.md). The count comes from the database; this decides.
import { RATE_LIMITS } from "./config";

export const RATE_WINDOW_MS = 60 * 60 * 1000;

export type RateLimitKind = "fareCheck" | "report";

const LIMITS: Record<RateLimitKind, { max: number; noun: string }> = {
  fareCheck: { max: RATE_LIMITS.fareChecksPerHour, noun: "fare checks" },
  report: { max: RATE_LIMITS.reportsPerHour, noun: "reports" },
};

export function windowStart(now: Date): Date {
  return new Date(now.getTime() - RATE_WINDOW_MS);
}

/**
 * Sliding-window limiter kept in memory. Per server instance only, so it's a speed bump for cheap
 * actions (like issuing upload URLs), not a substitute for the database-backed limits above.
 */
export class MemoryRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs = RATE_WINDOW_MS,
  ) {}

  /** Records a hit and returns true if it is allowed. */
  hit(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => t > now - this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.hits.delete(this.hits.keys().next().value as string);
    return true;
  }
}

/** null when allowed, otherwise a friendly message for the 429 response. */
export function rateLimitError(kind: RateLimitKind, countInWindow: number): string | null {
  const { max, noun } = LIMITS[kind];
  return countInWindow >= max ? `You've reached the limit of ${max} ${noun} per hour. Please try again a little later.` : null;
}
