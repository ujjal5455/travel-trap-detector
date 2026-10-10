// zod schemas for request input. Route handlers validate with these before touching anything else.
import { z } from "zod";
import { PLACE_SEARCH } from "./config";
import {
  BENCHMARK_SOURCES,
  CONFIDENCE_LEVELS,
  DISTANCE_METHODS,
  SCAM_TAGS,
  SERVICE_TYPES,
  SESSION_TYPES,
  VERDICTS,
} from "./types";

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const distanceRequestSchema = z.object({
  from: latLngSchema,
  to: latLngSchema,
});

export const geocodeQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(PLACE_SEARCH.minQueryLength, `Type at least ${PLACE_SEARCH.minQueryLength} characters`)
    .max(PLACE_SEARCH.maxQueryLength),
});

const MAX_QUOTE = 100_000;
const DAY_MS = 86_400_000;

/** POST /api/check body. Guides need a session type and no drop; everything else needs a drop. */
export const checkRequestSchema = z
  .object({
    serviceType: z.enum(SERVICE_TYPES),
    pickup: latLngSchema,
    drop: latLngSchema.optional(),
    sessionType: z.enum(SESSION_TYPES).optional(),
    /** ISO timestamp of the trip; defaults to now */
    tripTime: z.iso
      .datetime({ offset: true })
      .optional()
      .refine((t) => t === undefined || Math.abs(Date.parse(t) - Date.now()) <= 30 * DAY_MS, "must be within 30 days of today"),
    quotedPrice: z
      .number()
      .positive("must be more than ₹0")
      .max(MAX_QUOTE, `must be at most ₹${MAX_QUOTE.toLocaleString("en-IN")}`),
  })
  .superRefine((body, ctx) => {
    if (body.serviceType === "guide") {
      if (!body.sessionType) ctx.addIssue({ code: "custom", path: ["sessionType"], message: "choose half day or full day" });
    } else if (!body.drop) {
      ctx.addIssue({ code: "custom", path: ["drop"], message: "choose a drop point" });
    }
  });

export type CheckRequest = z.infer<typeof checkRequestSchema>;

/**
 * POST /api/explain body. The verdict comes from the browser, so every field is bounded:
 * the model only ever sees short, typed data, and the number guard checks against it.
 */
export const fareVerdictSchema = z.object({
  verdict: z.enum(VERDICTS),
  quotedPrice: z.number().positive().max(MAX_QUOTE),
  ratio: z.number().min(0).max(10_000),
  expectedFare: z.number().positive().max(1_000_000),
  fairRange: z.object({ min: z.number().min(0).max(1_000_000), max: z.number().min(0).max(1_000_000) }),
  distanceKm: z.number().min(0).max(5_000).nullable(),
  distanceMethod: z.enum(DISTANCE_METHODS).nullable(),
  benchmarkSource: z.enum(BENCHMARK_SOURCES),
  communitySampleSize: z.number().int().min(0).max(1_000_000),
  nearbyScam: z.object({
    count: z.number().int().min(0).max(1_000_000),
    distinctDevices: z.number().int().min(0).max(1_000_000),
    topTags: z.array(z.enum(SCAM_TAGS)).max(SCAM_TAGS.length),
  }),
  confidence: z.enum(CONFIDENCE_LEVELS),
  reasons: z.array(z.string().max(400)).max(12),
});

export const explainRequestSchema = z.object({ verdict: fareVerdictSchema });

/** First issue as a short, user-safe message. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue?.path.join(".");
  return path ? `${path}: ${issue.message}` : (issue?.message ?? "Invalid request");
}
