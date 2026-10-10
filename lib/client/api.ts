// Browser-side fetch wrapper for our own /api routes. Adds the anonymous device ID header.
import { DEVICE_ID_HEADER } from "../device";
import { getDeviceId } from "./device-id";

export { DEVICE_ID_HEADER };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set(DEVICE_ID_HEADER, getDeviceId());
  return fetch(path, { ...init, headers });
}

/** JSON request/response helper. Non-2xx responses throw ApiError with the route's `error` message. */
export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const res = await apiFetch(path, { ...init, headers });
  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}
