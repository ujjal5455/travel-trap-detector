// Human-readable labels for enum values, shared by reasons, UI and the AI prompt.
import type { BenchmarkSource, Confidence, ScamTag, ServiceType, SessionType, Verdict } from "./types";

/** Text label shown next to the verdict colour and icon (never colour alone). */
export const VERDICT_LABELS: Record<Verdict, { title: string; subtitle: string }> = {
  FAIR: { title: "Fair", subtitle: "This price looks fair" },
  SUSPICIOUS: { title: "Suspicious", subtitle: "This price may be on the high side" },
  HIGH_RISK: { title: "High risk", subtitle: "This price may be overpriced" },
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low confidence",
};

export const SOURCE_LABELS: Record<BenchmarkSource, string> = {
  official: "Official fare chart",
  app_comparison: "Ride-app comparison",
  demo_estimate: "Demo estimate",
};

export const SERVICE_LABELS: Record<ServiceType, string> = {
  auto: "Auto",
  taxi: "Taxi",
  bike_taxi: "Bike taxi",
  shared_sumo: "Shared Sumo seat",
  guide: "Local guide",
};

/** Noun phrase used in "for a 6.2 km auto ride". */
export const TRIP_NOUNS: Record<Exclude<ServiceType, "guide">, string> = {
  auto: "auto ride",
  taxi: "taxi ride",
  bike_taxi: "bike taxi ride",
  shared_sumo: "shared Sumo seat",
};

export const SESSION_LABELS: Record<SessionType, string> = {
  half_day: "half-day",
  full_day: "full-day",
};

export const SCAM_TAG_LABELS: Record<ScamTag, string> = {
  hidden_charges: "hidden charges",
  meter_refusal: "meter refusal",
  fake_closure_detour: "fake road closure or detour",
  inflated_tourist_price: "inflated tourist price",
  luggage_surcharge: "luggage surcharge",
  wrong_change: "wrong change",
  other: "other",
};

/** "a" or "an" before a number as spoken: an 8 km, an 11.6 km, an 18 km, a 110 km. */
export function articleForNumber(text: string): "a" | "an" {
  return /^(8|11(?!\d)|18(?!\d))/.test(text) ? "an" : "a";
}
