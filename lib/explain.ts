// Plain-language explanation of a FareVerdict.
// Phase 5: template only. Phase 6 adds the LLM, which must fall back to this template.
// Rules (docs/SPEC.md): 2–3 short friendly sentences + one polite tip, only numbers from the verdict,
// never blame or name anyone, no legal claims, "may be overpriced" rather than "scam".
import { COMMUNITY_ESCALATION, FAIR_RANGE } from "./config";
import { formatINR, formatRatio } from "./format";
import type { Explanation, FareVerdict } from "./types";

export function templateExplanation(v: FareVerdict, quotedPrice: number): Explanation {
  const range = `${formatINR(v.fairRange.min)}–${formatINR(v.fairRange.max)}`;
  const quoted = formatINR(quotedPrice);
  const expected = formatINR(v.expectedFare);
  const escalated = v.reasons.some((r) => r.startsWith("Raised from"));
  const busyArea =
    v.nearbyScam.count >= COMMUNITY_ESCALATION.minReports &&
    v.nearbyScam.distinctDevices >= COMMUNITY_ESCALATION.minDistinctDevices;

  const sentences: string[] = [];
  let tip: string;

  switch (v.verdict) {
    case "FAIR":
      sentences.push(
        v.ratio < FAIR_RANGE.lowFactor
          ? `${quoted} is below the expected ${expected} for this trip, so it looks fair.`
          : `${quoted} looks fair: it is close to the expected ${expected} for this trip.`,
      );
      sentences.push(`A fair price here is about ${range}.`);
      tip = "Agree the price before you set off, and keep small notes handy so change isn't a problem.";
      break;
    case "SUSPICIOUS":
      sentences.push(
        escalated
          ? `${quoted} is close to the usual price, but other travellers have reported problems near this pickup.`
          : `${quoted} may be on the high side: the expected fare is about ${expected}.`,
      );
      sentences.push(`A fair price here is about ${range}.`);
      tip = escalated
        ? "Confirm the full price, including luggage, before you get in, and politely decline any extra charges added later."
        : `Politely mention that the usual fare is around ${formatINR(v.fairRange.max)} and ask if they can match it.`;
      break;
    case "HIGH_RISK":
      sentences.push(
        v.ratio > 1
          ? `${quoted} may be overpriced: it is ${formatRatio(v.ratio)} the expected ${expected}.`
          : `${quoted} is near the usual price, but this pickup has many recent reports from other travellers.`,
      );
      sentences.push(`A fair price here is about ${range}.`);
      tip = `Stay calm and friendly: offer ${formatINR(v.fairRange.max)}, use "Show the driver" to explain, or try another vehicle nearby.`;
      break;
  }

  // The escalated SUSPICIOUS sentence already mentions other travellers.
  const alreadyMentioned = v.verdict === "SUSPICIOUS" && escalated;
  if (busyArea && !alreadyMentioned && v.verdict !== "FAIR") {
    sentences.push("Other travellers have also reported problems near this pickup recently.");
  } else if (v.confidence === "LOW") {
    sentences.push("This is a rough guide, because there is no local rate for this place.");
  }

  return { text: sentences.slice(0, 3).join(" "), tip, source: "template" };
}
