// zod schemas for request input. Route handlers validate with these before touching anything else.
import { z } from "zod";
import { PLACE_SEARCH } from "./config";

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

/** First issue as a short, user-safe message. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue?.path.join(".");
  return path ? `${path}: ${issue.message}` : (issue?.message ?? "Invalid request");
}
