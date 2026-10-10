// Human-readable labels for enum values, shared by reasons, UI and the AI prompt.
import type { ScamTag, ServiceType, SessionType } from "./types";

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
