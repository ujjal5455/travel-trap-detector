// Every tunable threshold lives here. The /about page renders these values directly,
// so changing a number here changes what judges read.

/** quoted ÷ expected: ≤ fairMax → FAIR, ≤ suspiciousMax → SUSPICIOUS, above → HIGH_RISK */
export const VERDICT_THRESHOLDS = {
  fairMax: 1.2,
  suspiciousMax: 1.6,
} as const;

/** Fair range = [expected × lowFactor, expected × highFactor], rounded to the nearest roundTo rupees. */
export const FAIR_RANGE = {
  lowFactor: 0.9,
  highFactor: 1.15,
  roundTo: 10,
} as const;

/** Community blend of reported paid prices into the expected fare. */
export const COMMUNITY_BLEND = {
  minSamples: 5,
  maxWeight: 0.5,
  /** weight = min(maxWeight, n / weightDivisor) */
  weightDivisor: 20,
  /** reports count when their distance is within ±distanceTolerance of the trip */
  distanceTolerance: 0.2,
  windowDays: 180,
} as const;

/** Raise the verdict one level when enough independent scam reports cluster near the pickup. */
export const COMMUNITY_ESCALATION = {
  radiusMeters: 500,
  minReports: 3,
  minDistinctDevices: 3,
  windowDays: 90,
} as const;

/** Defaults for benchmarks; the night window may cross midnight. Hours are IST. */
export const NIGHT_DEFAULTS = {
  start: 22,
  end: 5,
} as const;

/** Night window and "now" are evaluated in this zone, not the server's (Vercel runs UTC). */
export const TIME_ZONE = "Asia/Kolkata";

export const DISTANCE = {
  /** Haversine fallback multiplier to approximate road distance */
  roadFactor: 1.3,
  orsTimeoutMs: 4000,
  /** HeiGIT's current ORS endpoint (the old api.openrouteservice.org has a far lower daily quota) */
  orsBaseUrl: "https://api.heigit.org/openrouteservice",
  /** Road results are cached by coordinates rounded to this many decimals (4 ≈ 11 m) */
  cacheDecimals: 4,
  cacheMaxEntries: 500,
} as const;

/** Nominatim place search, limited to North East India (incl. Sikkim and the Siliguri corridor). */
export const GEOCODE = {
  baseUrl: "https://nominatim.openstreetmap.org/search",
  userAgent: "TravelTrapDetector/0.1 (CodeWar 8.0 hackathon prototype)",
  /** west, north, east, south: Nominatim's viewbox order is lon1,lat1,lon2,lat2 */
  bbox: { west: 88.0, north: 29.5, east: 97.5, south: 21.9 },
  maxResults: 8,
  cacheTtlMs: 24 * 60 * 60 * 1000,
  cacheMaxEntries: 500,
} as const;

export const RATE_LIMITS = {
  reportsPerHour: 5,
  fareChecksPerHour: 30,
} as const;

export const EXPLANATION = {
  timeoutMs: 6000,
  /** Used when LLM_BASE_URL / LLM_MODEL are not set */
  defaultBaseUrl: "https://api.groq.com/openai/v1",
  defaultModel: "qwen/qwen3.8-27b",
  temperature: 0.2,
  /** Reasoning models spend part of this on hidden reasoning; replies are length-checked anyway. */
  maxTokens: 800,
  maxTextChars: 600,
  maxTipChars: 300,
  /** The browser waits a little longer than the server timeout before using the template it already has. */
  clientTimeoutMs: 9000,
} as const;

export const PLACE_SEARCH = {
  minQueryLength: 3,
  maxQueryLength: 100,
  debounceMs: 500,
  /** Nominatim usage policy: max 1 request per second */
  nominatimMinIntervalMs: 1000,
} as const;

export const EVIDENCE_PHOTO = {
  /** Server hard cap (Vercel bodies max out at 4.5 MB) */
  maxBytes: 2 * 1024 * 1024,
  /** Client compresses to roughly this before upload */
  targetBytes: 1024 * 1024,
  mimeTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;
