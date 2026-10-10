// Anonymous device ID format, shared by the browser (which creates it) and the server (which checks it).

export const DEVICE_ID_HEADER = "x-device-id";

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDeviceId(value: unknown): value is string {
  return typeof value === "string" && UUID_V4_RE.test(value);
}
