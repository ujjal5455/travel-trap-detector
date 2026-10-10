"use client";
// Small event bus so any request can tell the offline banner "the server is unreachable" (even when
// navigator.onLine still says true, e.g. on a captive Wi-Fi) and "it's back".

export const NETWORK_ERROR_EVENT = "ttd:network-error";
export const NETWORK_OK_EVENT = "ttd:network-ok";

/** fetch() rejects with a TypeError when the network or server can't be reached at all. */
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

export function reportNetworkProblem(): void {
  window.dispatchEvent(new Event(NETWORK_ERROR_EVENT));
}

export function reportNetworkOk(): void {
  window.dispatchEvent(new Event(NETWORK_OK_EVENT));
}

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
