import "server-only";
import { EXPLANATION } from "../config";
import type { AiOptions } from "../explain";

/** LLM settings from the environment (Groq by default). No key means template explanations only. */
export function llmOptionsFromEnv(): AiOptions {
  return {
    apiKey: process.env.LLM_API_KEY?.trim() || undefined,
    baseUrl: process.env.LLM_BASE_URL?.trim() || EXPLANATION.defaultBaseUrl,
    model: process.env.LLM_MODEL?.trim() || EXPLANATION.defaultModel,
    reasoningEffort: process.env.LLM_REASONING_EFFORT?.trim() || undefined,
    onFallback: (reason) => console.warn(`Explanation fallback to template: ${reason}`),
  };
}
