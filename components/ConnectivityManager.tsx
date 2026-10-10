"use client";
// App-wide offline support: the offline banner, refreshing the saved offline pack, and sending
// queued reports when the connection comes back.
import { useEffect, useState, useSyncExternalStore } from "react";
import { NETWORK_ERROR_EVENT, NETWORK_OK_EVENT } from "@/lib/client/connectivity";
import { refreshOfflinePack } from "@/lib/client/offline-store";
import { flushQueue, QUEUE_CHANGED_EVENT, readQueue } from "@/lib/client/report-queue";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function subscribeQueue(onChange: () => void) {
  window.addEventListener(QUEUE_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    window.removeEventListener(QUEUE_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const RETRY_MS = 30_000;

export function ConnectivityManager() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const queued = useSyncExternalStore(subscribeQueue, () => readQueue().length, () => 0);
  const [serverUnreachable, setServerUnreachable] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Requests report "can't reach the server" even when navigator.onLine is true.
  useEffect(() => {
    const bad = () => setServerUnreachable(true);
    const good = () => setServerUnreachable(false);
    window.addEventListener(NETWORK_ERROR_EVENT, bad);
    window.addEventListener(NETWORK_OK_EVENT, good);
    window.addEventListener("online", good);
    return () => {
      window.removeEventListener(NETWORK_ERROR_EVENT, bad);
      window.removeEventListener(NETWORK_OK_EVENT, good);
      window.removeEventListener("online", good);
    };
  }, []);

  // Keep the offline pack fresh whenever we're online, but after the page has loaded and gone idle,
  // so the download never competes with what the traveller is waiting to see.
  useEffect(() => {
    if (!online) return;
    const run = () => void refreshOfflinePack();
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 10_000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(run, 3000);
    return () => clearTimeout(t);
  }, [online]);

  // Send queued reports: when back online, when the app returns to the foreground, and every 30 s while any wait.
  useEffect(() => {
    if (!online || queued === 0) return;
    let cancelled = false;
    const attempt = async () => {
      const result = await flushQueue();
      if (cancelled) return;
      if (result.sent > 0) {
        setServerUnreachable(false);
        setNotice(result.sent === 1 ? "Your saved report was sent. Thank you!" : `${result.sent} saved reports were sent. Thank you!`);
      }
    };
    void attempt();
    const timer = setInterval(() => void attempt(), RETRY_MS);
    const onVisible = () => document.visibilityState === "visible" && void attempt();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [online, queued]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const offline = !online || serverUnreachable;
  const waiting = queued > 0 ? ` ${queued === 1 ? "1 report is" : `${queued} reports are`} saved and will be sent when you're back online.` : "";

  return (
    <div aria-live="polite" className="sticky top-12 z-30">
      {offline && (
        <p role="status" className="mx-auto max-w-md bg-ink px-4 py-2 text-sm text-white">
          <span aria-hidden="true">📴 </span>
          <strong>You&apos;re offline.</strong> Fare checks give an offline estimate without community data.{waiting}
        </p>
      )}
      {!offline && queued > 0 && (
        <p role="status" className="mx-auto max-w-md bg-canvas px-4 py-2 text-sm">
          Sending {queued === 1 ? "your saved report" : `${queued} saved reports`}…
        </p>
      )}
      {notice && (
        <p role="status" className="mx-auto max-w-md bg-fair px-4 py-2 text-sm font-medium text-white">
          ✓ {notice}
        </p>
      )}
    </div>
  );
}
