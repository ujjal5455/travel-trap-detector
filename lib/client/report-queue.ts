"use client";
// Reports made without a connection are kept in localStorage and sent when it returns.
// Photos are kept as data URLs (they're already compressed to < 300 KB).
import { ApiError, apiJson } from "./api";
import type { CreateReportResponse, UploadUrlResponse } from "../types";

const KEY = "ttd.report-queue";
export const QUEUE_CHANGED_EVENT = "ttd:queue-changed";
/** Matches the hourly report limit; more than this couldn't be sent in one go anyway. */
const MAX_QUEUED = 5;

export interface QueuedReport {
  id: string;
  queuedAt: string;
  /** POST /api/reports body, without photoPath */
  payload: Record<string, unknown>;
  photoDataUrl?: string;
}

type Store = Pick<Storage, "getItem" | "setItem">;
const browserStore = (): Store | null => {
  try {
    return localStorage;
  } catch {
    return null;
  }
};

export function readQueue(store: Store | null = browserStore()): QueuedReport[] {
  try {
    const raw = store?.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedReport[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedReport[], store: Store | null = browserStore()): void {
  store?.setItem(KEY, JSON.stringify(items)); // may throw on quota: callers decide
  if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || "image/jpeg"};base64,${btoa(binary)}`;
}

/** Saves a report for later. Throws a user-facing Error if it can't be stored. */
export async function enqueueReport(payload: Record<string, unknown>, photo: Blob | null, store: Store | null = browserStore()) {
  const queue = readQueue(store);
  if (queue.length >= MAX_QUEUED) throw new Error(`You already have ${MAX_QUEUED} reports waiting to send.`);
  const item: QueuedReport = {
    id: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
    payload,
    ...(photo ? { photoDataUrl: await blobToDataUrl(photo) } : {}),
  };
  try {
    writeQueue([...queue, item], store);
  } catch {
    throw new Error("Couldn't save the report on this phone (storage is full).");
  }
  return item;
}

export type SendOutcome = "sent" | "retry" | "drop";

/** Sends one queued report: photo first (if any), then the report. */
export async function sendQueuedReport(item: QueuedReport): Promise<SendOutcome> {
  try {
    let photoPath: string | undefined;
    if (item.photoDataUrl) {
      const { path, signedUrl } = await apiJson<UploadUrlResponse>("/api/reports/upload-url", { method: "POST" });
      const blob = await (await fetch(item.photoDataUrl)).blob();
      const put = await fetch(signedUrl, { method: "PUT", headers: { "content-type": "image/jpeg", "x-upsert": "false" }, body: blob });
      if (!put.ok) return "retry";
      photoPath = path;
    }
    await apiJson<CreateReportResponse>("/api/reports", {
      method: "POST",
      body: JSON.stringify({ ...item.payload, ...(photoPath ? { photoPath } : {}) }),
    });
    return "sent";
  } catch (err) {
    // A report the server rejects as invalid will never succeed; drop it rather than retry forever.
    if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429) return "drop";
    return "retry"; // offline, rate-limited or server trouble
  }
}

let flushing: Promise<{ sent: number; dropped: number; remaining: number }> | null = null;

/** Sends everything that's queued, oldest first; stops at the first failure that is worth retrying. */
export function flushQueue(send: (item: QueuedReport) => Promise<SendOutcome> = sendQueuedReport, store: Store | null = browserStore()) {
  flushing ??= (async () => {
    let sent = 0;
    let dropped = 0;
    try {
      for (const item of readQueue(store)) {
        const outcome = await send(item);
        if (outcome === "retry") break;
        if (outcome === "sent") sent++;
        else dropped++;
        writeQueue(
          readQueue(store).filter((q) => q.id !== item.id),
          store,
        );
      }
    } finally {
      flushing = null;
    }
    return { sent, dropped, remaining: readQueue(store).length };
  })();
  return flushing;
}
