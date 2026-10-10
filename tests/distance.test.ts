import { describe, expect, it, vi } from "vitest";
import { distanceCacheKey, estimateDistance, getDistance } from "@/lib/distance";
import { LruCache } from "@/lib/lru-cache";
import type { DistanceResult } from "@/lib/distance";

const STATION = { lat: 26.1823701, lng: 91.7501234 };
const KAMAKHYA = { lat: 26.165107, lng: 91.7059298 };

function orsResponse(meters: number, seconds: number) {
  return Response.json({ routes: [{ summary: { distance: meters, duration: seconds } }] });
}

const freshCache = () => new LruCache<DistanceResult>(10);

describe("getDistance", () => {
  it("returns the ORS road distance and duration", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(orsResponse(6834, 1102));
    const result = await getDistance(STATION, KAMAKHYA, { apiKey: "k", fetchFn, cache: freshCache() });
    expect(result).toEqual({ distanceKm: 6.8, durationMin: 18, method: "road" });
  });

  it("sends the key as Authorization and coordinates as [lng, lat]", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(orsResponse(1000, 60));
    await getDistance(STATION, KAMAKHYA, { apiKey: "secret", fetchFn, cache: freshCache(), baseUrl: "https://ors.test" });

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://ors.test/v2/directions/driving-car");
    expect(new Headers(init?.headers).get("authorization")).toBe("secret");
    expect(JSON.parse(String(init?.body)).coordinates).toEqual([
      [STATION.lng, STATION.lat],
      [KAMAKHYA.lng, KAMAKHYA.lat],
    ]);
  });

  it("falls back to the estimate without calling ORS when there is no key", async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const onFallback = vi.fn();
    const result = await getDistance(STATION, KAMAKHYA, { fetchFn, cache: freshCache(), onFallback });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result).toEqual(estimateDistance(STATION, KAMAKHYA));
    expect(result.method).toBe("estimate");
    expect(onFallback).toHaveBeenCalledWith("ORS_API_KEY not set");
  });

  it("falls back on an HTTP error", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response("quota", { status: 429 }));
    const result = await getDistance(STATION, KAMAKHYA, { apiKey: "k", fetchFn, cache: freshCache() });
    expect(result.method).toBe("estimate");
  });

  it("falls back on a network error or malformed body", async () => {
    const network = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    expect((await getDistance(STATION, KAMAKHYA, { apiKey: "k", fetchFn: network, cache: freshCache() })).method).toBe(
      "estimate",
    );
    const empty = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ routes: [] }));
    expect((await getDistance(STATION, KAMAKHYA, { apiKey: "k", fetchFn: empty, cache: freshCache() })).method).toBe(
      "estimate",
    );
  });

  it("falls back when ORS is slower than the timeout", async () => {
    // Never resolves on its own; only the abort signal ends it.
    const slow = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const onFallback = vi.fn();
    const result = await getDistance(STATION, KAMAKHYA, {
      apiKey: "k",
      fetchFn: slow,
      timeoutMs: 20,
      cache: freshCache(),
      onFallback,
    });
    expect(result.method).toBe("estimate");
    expect(onFallback).toHaveBeenCalledWith("ORS timed out");
  });

  it("caches road results by rounded coordinates", async () => {
    const cache = freshCache();
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(orsResponse(6834, 1102));
    await getDistance(STATION, KAMAKHYA, { apiKey: "k", fetchFn, cache });
    // ~1 m away: same rounded key, no second request
    const nudged = { lat: STATION.lat + 0.00001, lng: STATION.lng };
    const again = await getDistance(nudged, KAMAKHYA, { apiKey: "k", fetchFn, cache });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(again.method).toBe("road");
  });

  it("does not cache estimates, so ORS is retried next time", async () => {
    const cache = freshCache();
    const failing = vi.fn<typeof fetch>().mockRejectedValue(new Error("down"));
    await getDistance(STATION, KAMAKHYA, { apiKey: "k", fetchFn: failing, cache });
    const working = vi.fn<typeof fetch>().mockResolvedValue(orsResponse(6834, 1102));
    const result = await getDistance(STATION, KAMAKHYA, { apiKey: "k", fetchFn: working, cache });
    expect(result.method).toBe("road");
  });
});

describe("estimateDistance", () => {
  it("is Haversine × 1.3, rounded to 0.1 km", () => {
    // straight line ≈ 4.82 km → × 1.3 ≈ 6.3 km
    expect(estimateDistance(STATION, KAMAKHYA)).toEqual({ distanceKm: 6.3, method: "estimate" });
  });
});

describe("distanceCacheKey", () => {
  it("is direction-sensitive", () => {
    expect(distanceCacheKey(STATION, KAMAKHYA)).not.toBe(distanceCacheKey(KAMAKHYA, STATION));
  });
});
