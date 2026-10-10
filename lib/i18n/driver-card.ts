// Typed access to the driver-card translations in driver-card.json.
import { formatINR } from "../format";
import data from "./driver-card.json";

export const DRIVER_CARD_KEYS = ["title", "from", "to", "guide", "halfDay", "fullDay", "line", "thanks"] as const;
export type DriverCardKey = (typeof DRIVER_CARD_KEYS)[number];

export const DRIVER_LANGUAGES = ["en", "as", "bn", "hi"] as const;
export type DriverLanguage = (typeof DRIVER_LANGUAGES)[number];

export const NEEDS_REVIEW = "needs native speaker review";

interface LanguageEntry {
  code: DriverLanguage;
  name: string;
  nativeName: string;
  strings: Record<DriverCardKey, { text: string; review: string }>;
}

export const driverCardLanguages = data.languages as LanguageEntry[];

export function driverLanguage(code: DriverLanguage): LanguageEntry {
  return driverCardLanguages.find((l) => l.code === code) ?? driverCardLanguages[0];
}

export function driverText(code: DriverLanguage, key: DriverCardKey): string {
  return driverLanguage(code).strings[key].text;
}

/** U+2060 WORD JOINER: stops a line break inside "₹150–₹190". Invisible, and ignored when copying. */
const JOIN = "⁠";

/** The polite line with the fair range filled in. Amounts keep Western digits, which everyone reads. */
export function driverLine(code: DriverLanguage, min: number, max: number): string {
  return driverText(code, "line")
    .replace("{min}–{max}", `${formatINR(min)}${JOIN}–${JOIN}${formatINR(max)}`)
    .replace("{min}", formatINR(min))
    .replace("{max}", formatINR(max));
}

export function isDriverLanguage(value: unknown): value is DriverLanguage {
  return typeof value === "string" && (DRIVER_LANGUAGES as readonly string[]).includes(value);
}
