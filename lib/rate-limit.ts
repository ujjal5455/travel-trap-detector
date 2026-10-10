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

/** null when allowed, otherwise a friendly message for the 429 response. */
export function rateLimitError(kind: RateLimitKind, countInWindow: number): string | null {
  const { max, noun } = LIMITS[kind];
  return countInWindow >= max ? `You've reached the limit of ${max} ${noun} per hour. Please try again a little later.` : null;
}
