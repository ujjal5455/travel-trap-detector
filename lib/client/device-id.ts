// Anonymous device ID: a random UUID kept in localStorage and sent as `x-device-id`.
// Known limitation (see README): anyone can clear or forge it. Fine for an MVP without accounts.

import { isDeviceId } from "../device";

export { isDeviceId };

export const DEVICE_ID_KEY = "ttd.device-id";

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

/** Used when localStorage is blocked (some private modes), so the ID is stable for the page's lifetime. */
let memoryId: string | null = null;

/**
 * Random v4 UUID. `crypto.randomUUID` only exists in secure contexts, so testing on a phone over
 * plain http://192.168.x.x needs the getRandomValues fallback.
 */
export function randomUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function browserStorage(): KeyValueStore | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getDeviceId(storage: KeyValueStore | null = browserStorage()): string {
  try {
    const stored = storage?.getItem(DEVICE_ID_KEY);
    if (isDeviceId(stored)) return stored;

    const id = randomUuid();
    storage?.setItem(DEVICE_ID_KEY, id);
    if (storage) return id;
  } catch {
    // Storage threw (quota, privacy mode); fall through to the in-memory ID.
  }
  memoryId ??= randomUuid();
  return memoryId;
}
