import { describe, expect, it, vi } from "vitest";
import { buildSearchUrl, createNominatimClient, normalizeQuery, toGeocodeResult } from "@/lib/nominatim";

const ITEM = {
  name: "Kamakhya Temple",
  display_name: "Kamakhya Temple, Pandu Kamakhya Road, Guwahati, Assam, India",
  lat: "26.1651070",
  lon: "91.7059298",
  osm_type: "node",
  osm_id: 6161176228,
};

/** Fake clock: sleep() advances time instantly so throttling is testable without waiting. */
function fakeClock() {
  let t = 1_000_000;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    advance: (ms: number) => {
      t += ms;
    },
    sleeps,
  };
}

describe("buildSearchUrl", () => {
  it("restricts results to the North East India box and India", () => {
    const url = new URL(buildSearchUrl("kamakhya"));
    expect(url.searchParams.get("q")).toBe("kamakhya");
    expect(url.searchParams.get("viewbox")).toBe("88,29.5,97.5,21.9");
    expect(url.searchParams.get("bounded")).toBe("1");
    expect(url.searchParams.get("countrycodes")).toBe("in");
    expect(url.searchParams.get("format")).toBe("jsonv2");
  });
});

describe("toGeocodeResult", () => {
  it("maps a Nominatim item", () => {
    expect(toGeocodeResult(ITEM)).toEqual({
      name: "Kamakhya Temple",
      displayName: ITEM.display_name,
      lat: 26.165107,
      lng: 91.7059298,
      osmId: "node/6161176228",
    });
  });

  it("falls back to the first part of the label when name is empty", () => {
    expect(toGeocodeResult({ ...ITEM, name: "" }).name).toBe("Kamakhya Temple");
  });
});

describe("normalizeQuery", () => {
  it("trims, collapses spaces and lowercases", () => {
    expect(normalizeQuery("  Kamakhya   TEMPLE ")).toBe("kamakhya temple");
  });
});

describe("nominatim client", () => {
  it("sends a custom User-Agent and returns mapped results", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(Response.json([ITEM]));
    const clock = fakeClock();
    const client = createNominatimClient({ fetchFn, now: clock.now, sleep: clock.sleep });

    const results = await client.search("Kamakhya");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Kamakhya Temple");
    expect(new Headers(fetchFn.mock.calls[0][1]?.headers).get("user-agent")).toMatch(/TravelTrapDetector/);
  });

  it("caches by normalised query", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(Response.json([ITEM]));
    const clock = fakeClock();
    const client = createNominatimClient({ fetchFn, now: clock.now, sleep: clock.sleep });

    await client.search("Kamakhya Temple");
    await client.search("  kamakhya   temple");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("waits so requests are at least 1 second apart", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => Response.json([ITEM]));
    const clock = fakeClock();
    const client = createNominatimClient({ fetchFn, now: clock.now, sleep: clock.sleep });

    await Promise.all([client.search("one"), client.search("two"), client.search("three")]);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(clock.sleeps).toEqual([1000, 1000]);
  });

  it("doesn't wait when the previous request was long ago", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => Response.json([]));
    const clock = fakeClock();
    const client = createNominatimClient({ fetchFn, now: clock.now, sleep: clock.sleep });

    await client.search("one");
    clock.advance(5000);
    await client.search("two");
    expect(clock.sleeps).toEqual([]);
  });

  it("throws on an HTTP error and keeps working afterwards", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(Response.json([ITEM]));
    const clock = fakeClock();
    const client = createNominatimClient({ fetchFn, now: clock.now, sleep: clock.sleep });

    await expect(client.search("one")).rejects.toThrow("503");
    await expect(client.search("one")).resolves.toHaveLength(1);
  });
});
