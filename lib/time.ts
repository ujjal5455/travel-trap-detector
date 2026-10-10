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

/** e.g. 22 → "22:00" */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}
