import { describe, expect, it } from "vitest";
import { DEVICE_ID_KEY, getDeviceId, isDeviceId, randomUuid } from "@/lib/client/device-id";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe("getDeviceId", () => {
  it("creates a UUID and persists it", () => {
    const storage = memoryStorage();
    const id = getDeviceId(storage);
    expect(isDeviceId(id)).toBe(true);
    expect(storage.data.get(DEVICE_ID_KEY)).toBe(id);
  });

  it("returns the same ID on later calls", () => {
    const storage = memoryStorage();
    expect(getDeviceId(storage)).toBe(getDeviceId(storage));
  });

  it("replaces a corrupted stored value", () => {
    const storage = memoryStorage({ [DEVICE_ID_KEY]: "not-a-uuid" });
    const id = getDeviceId(storage);
    expect(isDeviceId(id)).toBe(true);
    expect(id).not.toBe("not-a-uuid");
  });

  it("falls back to a stable in-memory ID when storage throws or is missing", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const a = getDeviceId(broken);
    expect(isDeviceId(a)).toBe(true);
    expect(getDeviceId(null)).toBe(a);
  });
});

describe("randomUuid", () => {
  it("produces v4 UUIDs", () => {
    for (let i = 0; i < 20; i++) expect(isDeviceId(randomUuid())).toBe(true);
  });
});
