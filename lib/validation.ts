// zod schemas for request input. Route handlers validate with these before touching anything else.
import { z } from "zod";
import { PLACE_SEARCH } from "./config";
import { SERVICE_TYPES, SESSION_TYPES } from "./types";

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

/** First issue as a short, user-safe message. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue?.path.join(".");
  return path ? `${path}: ${issue.message}` : (issue?.message ?? "Invalid request");
}
