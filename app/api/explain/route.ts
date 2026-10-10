import { explainVerdict } from "@/lib/explain";
import { LruCache } from "@/lib/lru-cache";
import { readDeviceId } from "@/lib/server/device";
import { llmOptionsFromEnv } from "@/lib/server/llm";
import type { Explanation, FareVerdict } from "@/lib/types";
import { explainRequestSchema, firstIssue } from "@/lib/validation";

/** Same verdict → same AI text. Saves the free LLM quota on retries and repeat views (per server instance). */
const aiCache = new LruCache<Explanation>(300, 60 * 60 * 1000);

/**
 * POST { verdict } → Explanation. Always answers 200 with something usable: the AI text when the
 * model is configured, responds within 6 s and passes the number guard, otherwise the template.
 */
export async function POST(request: Request) {
  if (!readDeviceId(request)) {
    return Response.json({ error: "Missing or invalid device ID. Reload the page and try again." }, { status: 400 });
  }
  const json: unknown = await request.json().catch(() => null);
  const parsed = explainRequestSchema.safeParse(json);
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });

  const verdict = parsed.data.verdict as FareVerdict;
  const key = JSON.stringify(verdict);
  const cached = aiCache.get(key);
  if (cached) return Response.json(cached);

  const explanation: Explanation = await explainVerdict(verdict, llmOptionsFromEnv());
  // Only AI results are cached, so a temporary failure doesn't pin the template.
  if (explanation.source === "ai") aiCache.set(key, explanation);
  return Response.json(explanation);
}
