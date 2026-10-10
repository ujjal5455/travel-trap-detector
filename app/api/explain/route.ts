import { explainVerdict } from "@/lib/explain";
import { readDeviceId } from "@/lib/server/device";
import { llmOptionsFromEnv } from "@/lib/server/llm";
import type { Explanation, FareVerdict } from "@/lib/types";
import { explainRequestSchema, firstIssue } from "@/lib/validation";

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

  const explanation: Explanation = await explainVerdict(parsed.data.verdict as FareVerdict, llmOptionsFromEnv());
  return Response.json(explanation);
}
