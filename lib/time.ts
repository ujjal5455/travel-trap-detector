import { TIME_ZONE } from "./config";

const hourFormat = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" });

/** Clock hour (0–23) of the instant in India time, whatever the server's own time zone is. */
export function localHour(date: Date): number {
  const hour = hourFormat.formatToParts(date).find((p) => p.type === "hour")?.value;
  return Number(hour) % 24;
}

/**
 * Whether `hour` falls in the night window [start, end). The window may cross midnight:
 * start 22, end 5 means 22:00–04:59. start === end means there is no night window.
 */
export function isNightHour(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export function isNightTime(date: Date, start: number, end: number): boolean {
  return isNightHour(localHour(date), start, end);
}

/** 12:00 India time on today's India date, as an instant. Used by demo mode so verdicts don't depend on the clock. */
export function noonInIndiaToday(now: Date = new Date()): Date {
  const IST_OFFSET_MS = 5.5 * 3600_000; // India has no daylight saving
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 12, 0) - IST_OFFSET_MS);
}

/** e.g. 22 → "22:00" */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}
