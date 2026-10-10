"use client";
// The offline pack (areas, places, rate cards) saved in localStorage after the first load,
// so fare checks and the place picker still work with no connection.
import type { OfflinePack } from "../types";

const KEY = "ttd.offline-pack";
/** Refresh at most this often while online. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function loadOfflinePack(): OfflinePack | null {
  try {
    const raw = localStorage.getItem(KEY);
    const pack = raw ? (JSON.parse(raw) as OfflinePack) : null;
    return pack?.version === 1 && pack.benchmarks.length > 0 ? pack : null;
  } catch {
    return null;
  }
}

function savePack(pack: OfflinePack): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(pack));
  } catch {
    // Storage full or blocked: offline checks just won't be available.
  }
}

/** Fetches a fresh pack when the saved one is missing or old. Never throws. */
export async function refreshOfflinePack(): Promise<void> {
  const current = loadOfflinePack();
  if (current && Date.now() - new Date(current.savedAt).getTime() < MAX_AGE_MS) return;
  try {
    const res = await fetch("/api/offline-pack");
    if (res.ok) savePack((await res.json()) as OfflinePack);
  } catch {
    // Offline: keep whatever we have.
  }
}
