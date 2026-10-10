// Server-side Nominatim search, limited to North East India.
// Usage policy: identifying User-Agent, max 1 request per second, cache results.
// https://operations.osmfoundation.org/policies/nominatim/
import { GEOCODE, PLACE_SEARCH } from "./config";
import { LruCache } from "./lru-cache";

export interface GeocodeResult {
  name: string;
  /** Full Nominatim label, e.g. "Kamakhya Temple, Pandu Kamakhya Road, …, Assam, India" */
  displayName: string;
  lat: number;
  lng: number;
  /** e.g. "node/6161176228" */
  osmId: string;
}

interface NominatimItem {
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  osm_type: string;
  osm_id: number;
}

export interface NominatimDeps {
  fetchFn?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  minIntervalMs?: number;
}

export function normalizeQuery(q: string): string {
  return q.trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildSearchUrl(q: string): string {
  const { west, north, east, south } = GEOCODE.bbox;
  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    countrycodes: "in",
    viewbox: `${west},${north},${east},${south}`,
    bounded: "1",
    limit: String(GEOCODE.maxResults),
    "accept-language": "en",
  });
  return `${GEOCODE.baseUrl}?${params}`;
}

export function toGeocodeResult(item: NominatimItem): GeocodeResult {
  return {
    name: item.name?.trim() || item.display_name.split(",")[0].trim(),
    displayName: item.display_name,
    lat: Number(item.lat),
    lng: Number(item.lon),
    osmId: `${item.osm_type}/${item.osm_id}`,
  };
}

export function createNominatimClient({
  fetchFn = fetch,
  now = Date.now,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  minIntervalMs = PLACE_SEARCH.nominatimMinIntervalMs,
}: NominatimDeps = {}) {
  const cache = new LruCache<GeocodeResult[]>(GEOCODE.cacheMaxEntries, GEOCODE.cacheTtlMs, now);
  let lastRequestAt = -Infinity;
  // Requests run one at a time, each starting at least minIntervalMs after the previous one.
  let queue: Promise<unknown> = Promise.resolve();

  function throttled<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(async () => {
      const wait = lastRequestAt + minIntervalMs - now();
      if (wait > 0) await sleep(wait);
      lastRequestAt = now();
      return task();
    });
    queue = run.catch(() => undefined);
    return run;
  }

  async function search(query: string): Promise<GeocodeResult[]> {
    const key = normalizeQuery(query);
    const cached = cache.get(key);
    if (cached) return cached;

    const results = await throttled(async () => {
      // A parallel request for the same query may have filled the cache while this one waited.
      const filled = cache.get(key);
      if (filled) return filled;

      const res = await fetchFn(buildSearchUrl(query.trim()), {
        headers: { "User-Agent": GEOCODE.userAgent, Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
      const items = (await res.json()) as NominatimItem[];
      return items.map(toGeocodeResult).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
    });

    cache.set(key, results);
    return results;
  }

  return { search };
}

/** Shared instance for the route handler, so the throttle and cache span all requests on this server. */
export const nominatim = createNominatimClient();
