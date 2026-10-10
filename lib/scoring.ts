// The fare scoring algorithm from docs/SPEC.md, as one pure function.
// No I/O: the caller passes the chosen benchmark and candidate reports; every rule
// (distance window, time windows, 500 m radius, distinct devices) is applied here.
import {
  COMMUNITY_BLEND,
  COMMUNITY_ESCALATION,
  FAIR_RANGE,
  VERDICT_THRESHOLDS,
} from "./config";
import { formatINR, formatKm, formatRatio, roundToNearest } from "./format";
import { haversineKm } from "./geo";
import { articleForNumber, SCAM_TAG_LABELS, SESSION_LABELS, TRIP_NOUNS } from "./labels";
import { formatHour, isNightTime } from "./time";
import {
  SCAM_TAGS,
  type Confidence,
  type DistanceMethod,
  type FareBenchmark,
  type FareVerdict,
  type FixedFare,
  type LatLng,
  type ScamTag,
  type ServiceType,
  type SessionType,
  type Verdict,
} from "./types";

/** A report as the scoring engine needs it (a subset of ReportRow, camelCased). */
export interface ReportSample {
  deviceId: string;
  areaId: string | null;
  serviceType: ServiceType;
  pickupLat: number;
  pickupLng: number;
  distanceKm: number | null;
  sessionType: SessionType | null;
  paidPrice: number | null;
  isScam: boolean;
  scamTags: readonly ScamTag[];
  createdAt: Date;
}

export interface ScoreInput {
  serviceType: ServiceType;
  quotedPrice: number;
  /** Area the pickup falls in; null = outside every area. */
  areaId: string | null;
  pickup: LatLng;
  /** Required for per-km services; null for guides. */
  distanceKm: number | null;
  distanceMethod: DistanceMethod | null;
  /** Required for guides. */
  sessionType: SessionType | null;
  /** When the trip happens; the night window is judged in India time. */
  tripTime: Date;
  /** "Now", for the 90- and 180-day windows. */
  now: Date;
  /** Already chosen with selectBenchmark: area-specific, or the regional default. */
  benchmark: FareBenchmark;
  /** Candidate reports for the community blend (filtered again here). */
  communityReports: readonly ReportSample[];
  /** Candidate scam reports near the pickup (filtered again here). */
  scamReports: readonly ReportSample[];
  /** An official fixed fare for this exact route (matchFixedFare); replaces the rate card in step 1. */
  fixedFare?: FixedFare | null;
}

export class ScoringInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoringInputError";
  }
}

const DAY_MS = 86_400_000;
const LEVELS: readonly Verdict[] = ["FAIR", "SUSPICIOUS", "HIGH_RISK"];
/** Tolerates float noise so a ratio of exactly 1.20 or 1.60 lands on the lower verdict. */
const EPSILON = 1e-9;

/** Step 1 helper: the area's benchmark for the service, else the regional default. */
export function selectBenchmark(
  benchmarks: readonly FareBenchmark[],
  areaId: string | null,
  serviceType: ServiceType,
): FareBenchmark {
  const match =
    (areaId !== null && benchmarks.find((b) => b.areaId === areaId && b.serviceType === serviceType)) ||
    benchmarks.find((b) => b.areaId === null && b.serviceType === serviceType);
  if (!match) throw new ScoringInputError(`No benchmark for ${serviceType} (area ${areaId ?? "none"}) and no regional default`);
  return match;
}

export function verdictForRatio(ratio: number): Verdict {
  if (ratio <= VERDICT_THRESHOLDS.fairMax + EPSILON) return "FAIR";
  if (ratio <= VERDICT_THRESHOLDS.suspiciousMax + EPSILON) return "SUSPICIOUS";
  return "HIGH_RISK";
}

export function raiseOneLevel(verdict: Verdict): Verdict {
  return LEVELS[Math.min(LEVELS.indexOf(verdict) + 1, LEVELS.length - 1)];
}

export function median(values: readonly number[]): number {
  if (values.length === 0) throw new ScoringInputError("median of an empty list");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Step 2 helper: paid prices of comparable, recent, non-scam reports, scaled to this trip. */
export function communitySamples(input: ScoreInput): number[] {
  if (input.areaId === null) return []; // "same area" is undefined outside every area
  const since = input.now.getTime() - COMMUNITY_BLEND.windowDays * DAY_MS;
  const isGuide = input.serviceType === "guide";
  const d = input.distanceKm;

  const samples: number[] = [];
  for (const r of input.communityReports) {
    if (r.isScam || r.paidPrice === null || r.paidPrice <= 0) continue;
    if (r.areaId !== input.areaId || r.serviceType !== input.serviceType) continue;
    if (r.createdAt.getTime() < since || r.createdAt.getTime() > input.now.getTime()) continue;

    if (isGuide) {
      if (r.sessionType === input.sessionType) samples.push(r.paidPrice);
      continue;
    }
    if (d === null || d <= 0 || r.distanceKm === null || r.distanceKm <= 0) continue;
    if (Math.abs(r.distanceKm - d) > COMMUNITY_BLEND.distanceTolerance * d) continue;
    samples.push(r.paidPrice * (d / r.distanceKm));
  }
  return samples;
}

/** Step 4 helper: scam reports within the radius of the pickup in the window. */
export function nearbyScams(input: ScoreInput): FareVerdict["nearbyScam"] {
  const since = input.now.getTime() - COMMUNITY_ESCALATION.windowDays * DAY_MS;
  const radiusKm = COMMUNITY_ESCALATION.radiusMeters / 1000;

  const near = input.scamReports.filter(
    (r) =>
      r.isScam &&
      r.createdAt.getTime() >= since &&
      r.createdAt.getTime() <= input.now.getTime() &&
      haversineKm(input.pickup, { lat: r.pickupLat, lng: r.pickupLng }) <= radiusKm,
  );

  const tagCounts = new Map<ScamTag, number>();
  for (const r of near) for (const t of r.scamTags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || SCAM_TAGS.indexOf(a[0]) - SCAM_TAGS.indexOf(b[0]))
    .slice(0, 3)
    .map(([tag]) => tag);

  return { count: near.length, distinctDevices: new Set(near.map((r) => r.deviceId)).size, topTags };
}

function validate(input: ScoreInput): void {
  const { benchmark: b } = input;
  if (!(input.quotedPrice > 0) || !Number.isFinite(input.quotedPrice)) {
    throw new ScoringInputError("quotedPrice must be a positive number");
  }
  if (b.serviceType !== input.serviceType) throw new ScoringInputError("benchmark is for a different service");
  if (b.pricingUnit === "per_km") {
    if (input.distanceKm === null || !(input.distanceKm >= 0)) {
      throw new ScoringInputError("distanceKm is required for per-km services");
    }
    if (b.baseFare === null || b.perKmRate === null || b.minFare === null) {
      throw new ScoringInputError("per-km benchmark is missing base_fare, per_km_rate or min_fare");
    }
  } else {
    if (input.sessionType === null) throw new ScoringInputError("sessionType is required for guides");
    if (!b.sessionRates || !(b.sessionRates[input.sessionType] > 0)) {
      throw new ScoringInputError(`benchmark has no ${input.sessionType} rate`);
    }
  }
}

/** Formats a percentage, adding a decimal when whole-number rounding would land on the threshold. */
function percentText(pct: number, mustExceed?: number): string {
  const whole = Math.round(pct);
  return mustExceed !== undefined && whole <= mustExceed ? `${pct.toFixed(1)}%` : `${whole}%`;
}

/**
 * Step 1 on its own: the rate-card fare for a trip (no community data). Also used to estimate
 * how far scam-report quotes were above the rate card on the hotspot map.
 * Throws ScoringInputError when the inputs don't fit the benchmark's pricing unit.
 */
export function benchmarkExpectedFare(
  b: FareBenchmark,
  distanceKm: number | null,
  sessionType: SessionType | null,
  tripTime: Date,
): { expected: number; minFareApplied: boolean; nightApplied: boolean } {
  if (b.pricingUnit === "per_km") {
    if (distanceKm === null || !(distanceKm >= 0) || b.baseFare === null || b.perKmRate === null || b.minFare === null) {
      throw new ScoringInputError("per-km fare needs a distance and a complete benchmark");
    }
    const metered = b.baseFare + b.perKmRate * distanceKm;
    const minFareApplied = metered < b.minFare;
    const nightApplied = b.nightMultiplier > 1 && isNightTime(tripTime, b.nightStart, b.nightEnd);
    const expected = Math.max(b.minFare, metered) * (nightApplied ? b.nightMultiplier : 1);
    return { expected, minFareApplied, nightApplied };
  }
  const rate = sessionType === null ? undefined : b.sessionRates?.[sessionType];
  if (!(rate !== undefined && rate > 0)) throw new ScoringInputError("per-session fare needs a session rate");
  return { expected: rate, minFareApplied: false, nightApplied: false };
}

export function scoreFare(input: ScoreInput): FareVerdict {
  validate(input);
  const { benchmark: b, quotedPrice } = input;
  const reasons: string[] = [];
  const isPerKm = b.pricingUnit === "per_km";

  // 1. Expected fare: an official fixed fare for this exact route if there is one, otherwise the rate card.
  const fixed = input.fixedFare && input.fixedFare.serviceType === input.serviceType ? input.fixedFare : null;
  const {
    expected: benchmarkExpected,
    minFareApplied,
    nightApplied,
  } = fixed
    ? { expected: fixed.fare, minFareApplied: false, nightApplied: false }
    : benchmarkExpectedFare(b, input.distanceKm, input.sessionType, input.tripTime);
  const baseName = fixed ? "official fare" : "rate card";

  // 2. Community blend.
  const samples = communitySamples(input);
  const n = samples.length;
  const blended = n >= COMMUNITY_BLEND.minSamples;
  const weight = blended ? Math.min(COMMUNITY_BLEND.maxWeight, n / COMMUNITY_BLEND.weightDivisor) : 0;
  const communityMedian = blended ? median(samples) : null;
  const expectedFare = Math.round(
    communityMedian === null ? benchmarkExpected : (1 - weight) * benchmarkExpected + weight * communityMedian,
  );

  // 3. Ratio and base verdict.
  const ratio = quotedPrice / expectedFare;
  const priceVerdict = verdictForRatio(ratio);

  // 4. Community escalation.
  const nearbyScam = nearbyScams(input);
  const escalate =
    nearbyScam.count >= COMMUNITY_ESCALATION.minReports &&
    nearbyScam.distinctDevices >= COMMUNITY_ESCALATION.minDistinctDevices;
  const verdict = escalate ? raiseOneLevel(priceVerdict) : priceVerdict;

  // 5. Fair range.
  const fairRange = {
    min: roundToNearest(expectedFare * FAIR_RANGE.lowFactor, FAIR_RANGE.roundTo),
    max: roundToNearest(expectedFare * FAIR_RANGE.highFactor, FAIR_RANGE.roundTo),
  };

  // 6. Confidence. An official route fare counts as local data.
  const areaSpecific = fixed !== null || b.areaId !== null;
  const confidence: Confidence = areaSpecific ? (blended ? "HIGH" : "MEDIUM") : "LOW";

  // 7. Reasons: short, factual, built only from the numbers above.
  const trip = isPerKm
    ? (() => {
        const km = formatKm(input.distanceKm as number);
        return `${articleForNumber(km)} ${km} ${TRIP_NOUNS[input.serviceType as Exclude<ServiceType, "guide">]}`;
      })()
    : `a ${SESSION_LABELS[input.sessionType as SessionType]} guide`;
  reasons.push(`Quoted ${formatINR(quotedPrice)} is ${formatRatio(ratio)} the expected ${formatINR(expectedFare)} for ${trip}.`);

  const fairPct = Math.round((VERDICT_THRESHOLDS.fairMax - 1) * 100);
  const highPct = Math.round((VERDICT_THRESHOLDS.suspiciousMax - 1) * 100);
  const pct = (ratio - 1) * 100;
  if (Math.round(pct) === 0) {
    reasons.push("That is about the same as the expected fare.");
  } else if (ratio < 1) {
    reasons.push(`That is ${percentText(-pct)} below the expected fare.`);
  } else if (priceVerdict === "FAIR") {
    reasons.push(`That is ${percentText(pct)} above the expected fare, within the ${fairPct}% allowance.`);
  } else if (priceVerdict === "SUSPICIOUS") {
    reasons.push(`That is ${percentText(pct, fairPct)} above the expected fare, more than the ${fairPct}% allowance.`);
  } else {
    reasons.push(`That is ${percentText(pct, highPct)} above the expected fare, more than ${highPct}% over.`);
  }

  if (fixed) {
    reasons.push(
      `The official fixed fare from ${fixed.originName} to ${fixed.destName} is ${formatINR(fixed.fare)}${
        fixed.listedKm ? ` (about ${fixed.listedKm} km)` : ""
      }.`,
    );
  }
  if (minFareApplied) reasons.push(`The minimum fare of ${formatINR(b.minFare as number)} applies to short trips.`);
  if (nightApplied) {
    reasons.push(`Night rate applied: ×${b.nightMultiplier} between ${formatHour(b.nightStart)} and ${formatHour(b.nightEnd)}.`);
  }
  if (input.distanceMethod === "estimate") {
    reasons.push("Road distance was unavailable, so the distance is an estimate (straight line × 1.3).");
  }
  if (!areaSpecific) reasons.push("There is no local rate for this place, so the regional default rate is used.");

  if (blended && communityMedian !== null) {
    reasons.push(
      `Expected fare blends the ${baseName} with ${n} recent traveller reports for similar trips (median ${formatINR(Math.round(communityMedian))}).`,
    );
  } else if (n > 0) {
    reasons.push(
      `Only ${n} similar traveller report${n === 1 ? "" : "s"} so far (${COMMUNITY_BLEND.minSamples} needed), so the ${baseName} alone is used.`,
    );
  }

  const radius = COMMUNITY_ESCALATION.radiusMeters;
  const days = COMMUNITY_ESCALATION.windowDays;
  const tagText = nearbyScam.topTags.length
    ? ` Most reported: ${nearbyScam.topTags.map((t) => SCAM_TAG_LABELS[t]).join(", ")}.`
    : "";
  if (escalate && verdict !== priceVerdict) {
    reasons.push(
      `Raised from ${priceVerdict} to ${verdict}: ${nearbyScam.count} scam reports from ${nearbyScam.distinctDevices} different travellers within ${radius} m of this pickup in the last ${days} days.${tagText}`,
    );
  } else if (escalate) {
    reasons.push(
      `Also, ${nearbyScam.count} scam reports from ${nearbyScam.distinctDevices} different travellers within ${radius} m of this pickup in the last ${days} days.${tagText}`,
    );
  } else if (nearbyScam.count > 0) {
    reasons.push(
      `${nearbyScam.count} scam report${nearbyScam.count === 1 ? "" : "s"} near this pickup in the last ${days} days, not enough independent reports to change the verdict.`,
    );
  }

  return {
    verdict,
    quotedPrice,
    ratio: Math.round(ratio * 100) / 100,
    expectedFare,
    fairRange,
    distanceKm: isPerKm ? input.distanceKm : null,
    distanceMethod: isPerKm ? input.distanceMethod : null,
    benchmarkSource: fixed ? fixed.source : b.source,
    communitySampleSize: n,
    nearbyScam,
    confidence,
    reasons,
    fixedFare: fixed
      ? { origin: fixed.originName, destination: fixed.destName, fare: fixed.fare, listedKm: fixed.listedKm, sourceNote: fixed.sourceNote }
      : null,
  };
}
