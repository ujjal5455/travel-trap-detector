import { describe, expect, it, vi } from "vitest";
import {
  aiExplanation,
  explainVerdict,
  explanationFacts,
  SYSTEM_PROMPT,
  templateExplanation,
  validateAiReply,
} from "@/lib/explain";
import { unexpectedNumbers } from "@/lib/number-guard";
import type { FareVerdict } from "@/lib/types";

const base: FareVerdict = {
  verdict: "FAIR",
  quotedPrice: 170,
  ratio: 1.04,
  expectedFare: 163,
  fairRange: { min: 150, max: 190 },
  distanceKm: 6.8,
  distanceMethod: "road",
  benchmarkSource: "demo_estimate",
  communitySampleSize: 7,
  nearbyScam: { count: 0, distinctDevices: 0, topTags: [] },
  confidence: "HIGH",
  reasons: ["Quoted ₹170 is 1.0× the expected ₹163 for a 6.8 km auto ride."],
};

const highRisk: FareVerdict = {
  ...base,
  verdict: "HIGH_RISK",
  quotedPrice: 330,
  ratio: 2.02,
  nearbyScam: { count: 9, distinctDevices: 4, topTags: ["inflated_tourist_price"] },
  reasons: [
    "Quoted ₹330 is 2.0× the expected ₹163 for a 6.8 km auto ride.",
    "That is 102% above the expected fare, more than 60% over.",
    "Also, 9 scam reports from 4 different travellers within 500 m of this pickup in the last 90 days.",
  ],
};

const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).filter(Boolean);

/** A fake Groq / OpenAI-compatible chat completion returning `reply` as the message content. */
function llmReply(reply: unknown, status = 200) {
  const content = typeof reply === "string" ? reply : JSON.stringify(reply);
  return vi.fn<typeof fetch>().mockResolvedValue(
    status === 200 ? Response.json({ choices: [{ message: { content } }] }) : new Response("error", { status }),
  );
}

// ---------------------------------------------------------------------------

describe("templateExplanation", () => {
  it("FAIR: says it looks fair and gives the range", () => {
    const e = templateExplanation(base);
    expect(e.source).toBe("template");
    expect(e.text).toBe("₹170 looks fair: it is close to the expected ₹163 for this trip. A fair price here is about ₹150–₹190.");
    expect(e.tip.length).toBeGreaterThan(10);
  });

  it("SUSPICIOUS by price: suggests asking for the usual fare", () => {
    const e = templateExplanation({ ...base, verdict: "SUSPICIOUS", ratio: 1.4, quotedPrice: 230 });
    expect(e.text).toContain("may be on the high side");
    expect(e.tip).toContain("₹190");
  });

  it("SUSPICIOUS by escalation: mentions other travellers, not the price", () => {
    const v: FareVerdict = {
      ...base,
      verdict: "SUSPICIOUS",
      nearbyScam: { count: 9, distinctDevices: 4, topTags: ["inflated_tourist_price"] },
      reasons: [...base.reasons, "Raised from FAIR to SUSPICIOUS: 9 scam reports ..."],
    };
    expect(templateExplanation(v).text).toContain("other travellers have reported problems near this pickup");
  });

  it("HIGH_RISK: says 'may be overpriced' with the ratio, and adds the nearby-reports note", () => {
    const e = templateExplanation(highRisk);
    expect(e.text).toContain("₹330 may be overpriced: it is 2.0× the expected ₹163.");
    expect(e.text).toContain("Other travellers have also reported problems near this pickup recently.");
  });

  it("HIGH_RISK raised by escalation still mentions other travellers", () => {
    const v: FareVerdict = {
      ...highRisk,
      ratio: 1.4,
      reasons: [...base.reasons, "Raised from SUSPICIOUS to HIGH_RISK: 9 scam reports ..."],
    };
    expect(templateExplanation(v).text).toContain("Other travellers have also reported problems");
  });

  it("FAIR well below the expected fare doesn't claim it is 'close'", () => {
    const e = templateExplanation({ ...base, ratio: 0.5, quotedPrice: 80 });
    expect(e.text).toContain("₹80 is below the expected ₹163 for this trip, so it looks fair.");
  });

  it("LOW confidence: says it is a rough guide", () => {
    expect(templateExplanation({ ...base, confidence: "LOW" }).text).toContain("rough guide");
  });

  it("never uses accusing words and stays within 2–3 sentences", () => {
    for (const verdict of ["FAIR", "SUSPICIOUS", "HIGH_RISK"] as const) {
      for (const confidence of ["HIGH", "LOW"] as const) {
        const e = templateExplanation({ ...highRisk, verdict, confidence });
        expect(`${e.text} ${e.tip}`).not.toMatch(/scam|cheat|fraud|illegal|police|driver is/i);
        expect(sentences(e.text).length).toBeGreaterThanOrEqual(2);
        expect(sentences(e.text).length).toBeLessThanOrEqual(3);
      }
    }
  });

  it("names the official prepaid fare when one applies, and suggests the airport counter", () => {
    const official: FareVerdict = {
      ...base,
      verdict: "SUSPICIOUS",
      quotedPrice: 800,
      ratio: 1.38,
      expectedFare: 580,
      fairRange: { min: 520, max: 670 },
      distanceKm: 23.4,
      benchmarkSource: "official",
      fixedFare: { origin: "LGBI Airport", destination: "Paltan Bazaar", fare: 580, listedKm: 25, sourceNote: "AAI list" },
    };
    const e = templateExplanation(official);
    expect(e.text).toContain("The official airport prepaid fare to Paltan Bazaar is ₹580, so a fair price is about ₹520–₹670.");
    expect(e.tip).toMatch(/prepaid taxi counter/);
    expect(unexpectedNumbers(`${e.text} ${e.tip}`, explanationFacts(official))).toEqual([]);
    expect(explanationFacts(official).officialFixedFare).toEqual({ from: "LGBI Airport", to: "Paltan Bazaar", fare: 580, listedKm: 25 });
  });

  it("always passes its own number guard", () => {
    for (const v of [base, highRisk, { ...highRisk, verdict: "SUSPICIOUS" as const }, { ...base, ratio: 0.5, quotedPrice: 80 }]) {
      const e = templateExplanation(v);
      expect(unexpectedNumbers(`${e.text} ${e.tip}`, explanationFacts(v))).toEqual([]);
    }
  });
});

describe("aiExplanation", () => {
  const good = {
    text: "₹330 may be overpriced: it is about 2× the expected ₹163. A fair price here is ₹150–₹190. Other travellers have reported problems near this pickup.",
    tip: "Politely offer ₹190 and show the fair range.",
  };

  it("returns the model's text when it passes every check", async () => {
    const fetchFn = llmReply(good);
    const e = await aiExplanation(highRisk, { apiKey: "k", fetchFn });
    expect(e).toEqual({ ...good, source: "ai" });
  });

  it("sends the system prompt, the facts as data, JSON mode and the configured model", async () => {
    const fetchFn = llmReply(good);
    await aiExplanation(highRisk, { apiKey: "secret", fetchFn, baseUrl: "https://llm.test/v1/", model: "test-model" });

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://llm.test/v1/chat/completions");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret");
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("test-model");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0]).toEqual({ role: "system", content: SYSTEM_PROMPT });
    expect(JSON.parse(body.messages[1].content)).toEqual(explanationFacts(highRisk));
  });

  it("sends reasoning_effort only when configured", async () => {
    const withEffort = llmReply(good);
    await aiExplanation(highRisk, { apiKey: "k", fetchFn: withEffort, reasoningEffort: "none" });
    expect(JSON.parse(String(withEffort.mock.calls[0][1]?.body)).reasoning_effort).toBe("none");

    const without = llmReply(good);
    await aiExplanation(highRisk, { apiKey: "k", fetchFn: without });
    expect(JSON.parse(String(without.mock.calls[0][1]?.body))).not.toHaveProperty("reasoning_effort");
  });

  it("includes the provider's error code in the failure reason", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ error: { code: "rate_limit_exceeded", message: "slow down" } }, { status: 429 }));
    await expect(aiExplanation(highRisk, { apiKey: "k", fetchFn })).rejects.toThrow("LLM responded 429 (rate_limit_exceeded)");
  });

  it("system prompt carries the docs/SPEC.md rules", () => {
    expect(SYSTEM_PROMPT).toMatch(/only the facts/i);
    expect(SYSTEM_PROMPT).toMatch(/2 or 3 short sentences/);
    expect(SYSTEM_PROMPT).toMatch(/may be overpriced/);
    expect(SYSTEM_PROMPT).toMatch(/never mention or describe individual/i);
    expect(SYSTEM_PROMPT).toMatch(/non-native speaker/);
  });
});

describe("explainVerdict falls back to the template", () => {
  const cases: [string, Parameters<typeof explainVerdict>[1], RegExp][] = [
    ["no API key", { fetchFn: llmReply({ text: "x", tip: "y" }) }, /LLM_API_KEY not set/],
    [
      "an invented number",
      {
        apiKey: "k",
        fetchFn: llmReply({
          text: "₹330 may be overpriced. Most drivers charge ₹250 for this trip.",
          tip: "Offer ₹190.",
        }),
      },
      /invented numbers: 250/,
    ],
    [
      "an accusing word",
      { apiKey: "k", fetchFn: llmReply({ text: "This driver is a cheat. ₹330 is too much.", tip: "Offer ₹190." }) },
      /accusing/,
    ],
    ["an HTTP error", { apiKey: "k", fetchFn: llmReply("", 429) }, /429/],
    ["a reply that isn't JSON", { apiKey: "k", fetchFn: llmReply("Sure! Here is your explanation.") }, /not JSON/],
    ["a reply missing the tip", { apiKey: "k", fetchFn: llmReply({ text: "₹330 may be overpriced." }) }, /missing/],
    [
      "too many sentences",
      {
        apiKey: "k",
        fetchFn: llmReply({ text: "One. Two. Three. Four. Five.", tip: "Offer ₹190." }),
      },
      /5 sentences/,
    ],
    ["a network failure", { apiKey: "k", fetchFn: vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed")) }, /fetch failed/],
  ];

  it.each(cases)("on %s", async (_label, opts, reason) => {
    const onFallback = vi.fn();
    const e = await explainVerdict(highRisk, { ...opts, onFallback });
    expect(e).toEqual(templateExplanation(highRisk));
    expect(onFallback.mock.calls[0][0]).toMatch(reason);
  });

  it("on a timeout (6 seconds in production)", async () => {
    const slow = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const onFallback = vi.fn();
    const e = await explainVerdict(highRisk, { apiKey: "k", fetchFn: slow, timeoutMs: 20, onFallback });
    expect(e.source).toBe("template");
    expect(onFallback).toHaveBeenCalledWith("LLM timed out");
  });
});

describe("validateAiReply", () => {
  it("allows the phrase 'scam reports' from the facts but not calling something a scam", () => {
    expect(validateAiReply("9 scam reports were made near this pickup. ₹330 may be overpriced.", "Offer ₹190.", highRisk)).toBeNull();
    expect(validateAiReply("This is a scam. ₹330 is too much.", "Offer ₹190.", highRisk)).toMatch(/accusing/);
  });
});
