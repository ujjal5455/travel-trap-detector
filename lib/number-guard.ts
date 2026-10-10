// Rejects AI text that contains any number not present in the facts it was given.
// "Present" allows for rounding: 163 may appear as 160, 2.02 as 2.0 or 2.

import { roundToNearest } from "./format";

/** Digits with optional thousands separators (Indian or Western grouping) and decimals. ₹ and × are ignored. */
const NUMBER_RE = /\d+(?:,\d+)*(?:\.\d+)?/g;

export function extractNumbers(text: string): number[] {
  return (text.match(NUMBER_RE) ?? []).map((s) => Number(s.replace(/,/g, "")));
}

/** Every number in the facts, as they'd appear in JSON (including numbers inside strings like the reasons). */
export function allowedNumbers(facts: unknown): Set<number> {
  return new Set(extractNumbers(JSON.stringify(facts)));
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/** Ways a fact may legitimately appear after rounding. */
function roundedForms(n: number): number[] {
  return [n, round(n, 0), round(n, 1), round(n, 2), roundToNearest(n, 10)];
}

export function isAllowed(value: number, allowed: Set<number>): boolean {
  if (allowed.has(value)) return true;
  for (const n of allowed) {
    if (roundedForms(n).some((r) => Math.abs(r - value) < 1e-9)) return true;
  }
  return false;
}

/** Numbers in `text` that don't come from `facts`. Empty means the text passes. */
export function unexpectedNumbers(text: string, facts: unknown): number[] {
  const allowed = allowedNumbers(facts);
  return extractNumbers(text).filter((n) => !isAllowed(n, allowed));
}
