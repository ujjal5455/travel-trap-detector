import { describe, expect, it } from "vitest";
import { LruCache } from "@/lib/lru-cache";

describe("LruCache", () => {
  it("evicts the least recently used entry", () => {
    const cache = new LruCache<number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // a is now most recent
    cache.set("c", 3);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
  });

  it("expires entries after the TTL", () => {
    let t = 0;
    const cache = new LruCache<string>(10, 100, () => t);
    cache.set("k", "v");
    t = 99;
    expect(cache.get("k")).toBe("v");
    t = 100;
    expect(cache.get("k")).toBeUndefined();
    expect(cache.size).toBe(0);
  });
});
