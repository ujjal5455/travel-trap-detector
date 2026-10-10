import "server-only";
import { DEVICE_ID_HEADER, isDeviceId } from "../device";

/** The caller's anonymous device ID, or null if the header is missing or malformed. */
export function readDeviceId(request: Request): string | null {
  const value = request.headers.get(DEVICE_ID_HEADER);
  return isDeviceId(value) ? value.toLowerCase() : null;
}
