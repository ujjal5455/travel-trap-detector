// Removes phone numbers and Indian vehicle registration numbers from free text (docs/SPEC.md:
// flag patterns and places, never individuals). Runs on the server before a report is stored.

export const REDACTED = "[removed]";

/**
 * Any run of digits (with optional + ( ) spaces, dots or dashes between them) that holds 8 or more
 * digits: mobile numbers (+91 98640 12345), landlines (0361-2345678) and similar. Prices are far shorter.
 */
const PHONE_RE = /\+?\(?\d(?:[\s().-]*\d){7,}/g;

/** RTO state codes used on Indian plates. */
const STATE_CODES =
  "AN|AP|AR|AS|BR|CG|CH|DD|DL|DN|GA|GJ|HP|HR|JH|JK|KA|KL|LA|LD|MH|ML|MN|MP|MZ|NL|OD|OR|PB|PY|RJ|SK|TN|TR|TS|UK|UP|WB";

/** Letter pairs that are units or common words, so "as 12 km 1500" isn't treated as a plate. */
const NOT_A_SERIES = "(?!(?:km|kms|hr|hrs|rs|am|pm|min|mins)\\b)";

/** e.g. AS 01 AB 1234, AS01AB1234, ml-05-c-1234, as 1 bc 123 */
const PLATE_RE = new RegExp(
  `\\b(?:${STATE_CODES})[\\s.-]?\\d{1,2}[\\s.-]?${NOT_A_SERIES}[A-Z]{1,3}[\\s.-]?\\d{3,4}\\b`,
  "gi",
);

/** Bharat-series plates, e.g. 22 BH 1234 AA */
const BH_PLATE_RE = /\b\d{2}[\s.-]?BH[\s.-]?\d{4}[\s.-]?[A-Z]{1,2}\b/gi;

export function redactPersonalDetails(text: string): { text: string; redacted: boolean } {
  const out = text.replace(BH_PLATE_RE, REDACTED).replace(PLATE_RE, REDACTED).replace(PHONE_RE, REDACTED);
  return { text: out, redacted: out !== text };
}
