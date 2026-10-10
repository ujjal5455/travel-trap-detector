import { describe, expect, it, vi } from "vitest";
import { enqueueReport, flushQueue, readQueue, type QueuedReport } from "@/lib/client/report-queue";

function memoryStore() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

const payload = (n: number) => ({ serviceType: "auto", paidPrice: 100 + n, isScam: false });

describe("report queue", () => {
  it("stores reports, with the photo as a data URL", async () => {
    const store = memoryStore();
    await enqueueReport(payload(1), null, store);
    await enqueueReport(payload(2), new Blob([new Uint8Array([255, 216, 255])], { type: "image/jpeg" }), store);
    const q = readQueue(store);
    expect(q).toHaveLength(2);
    expect(q[0].photoDataUrl).toBeUndefined();
    expect(q[1].photoDataUrl).toBe("data:image/jpeg;base64,/9j/");
  });

  it("refuses more than 5 waiting reports", async () => {
    const store = memoryStore();
    for (let i = 0; i < 5; i++) await enqueueReport(payload(i), null, store);
    await expect(enqueueReport(payload(6), null, store)).rejects.toThrow(/5 reports waiting/);
  });

  it("sends oldest first and removes each one that was sent", async () => {
    const store = memoryStore();
    for (let i = 0; i < 3; i++) await enqueueReport(payload(i), null, store);
    const order: unknown[] = [];
    const send = vi.fn(async (item: QueuedReport) => {
      order.push(item.payload.paidPrice);
      return "sent" as const;
    });
    expect(await flushQueue(send, store)).toEqual({ sent: 3, dropped: 0, remaining: 0 });
    expect(order).toEqual([100, 101, 102]);
  });

  it("stops at the first retryable failure and keeps the rest", async () => {
    const store = memoryStore();
    for (let i = 0; i < 3; i++) await enqueueReport(payload(i), null, store);
    const send = vi.fn().mockResolvedValueOnce("sent").mockResolvedValueOnce("retry");
    expect(await flushQueue(send, store)).toEqual({ sent: 1, dropped: 0, remaining: 2 });
    expect(readQueue(store).map((q) => q.payload.paidPrice)).toEqual([101, 102]);
  });

  it("drops reports the server rejects as invalid", async () => {
    const store = memoryStore();
    await enqueueReport(payload(1), null, store);
    await enqueueReport(payload(2), null, store);
    const send = vi.fn().mockResolvedValueOnce("drop").mockResolvedValueOnce("sent");
    expect(await flushQueue(send, store)).toEqual({ sent: 1, dropped: 1, remaining: 0 });
  });

  it("runs one flush at a time", async () => {
    const store = memoryStore();
    await enqueueReport(payload(1), null, store);
    const send = vi.fn(async () => "sent" as const);
    const [a, b] = await Promise.all([flushQueue(send, store), flushQueue(send, store)]);
    expect(a).toBe(b);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
