"use client";

import { useEffect, useRef, useState } from "react";
import { PlacePicker } from "@/components/PlacePicker";
import { VerdictCard } from "@/components/VerdictCard";
import { ApiError, apiJson } from "@/lib/client/api";
import { isNetworkError, isOffline, reportNetworkOk, reportNetworkProblem } from "@/lib/client/connectivity";
import { loadOfflinePack } from "@/lib/client/offline-store";
import { offlineCheck } from "@/lib/offline-check";
import type { CheckResponse, PlaceChoice, ReportDraft, ServiceType, SessionType } from "@/lib/types";
import type { DemoScenario } from "@/lib/demo-scenarios";
import { noonInIndiaToday } from "@/lib/time";
import { DemoPicker } from "./DemoPicker";
import { ServicePicker } from "./ServicePicker";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string; retryable: boolean; payload: CheckPayload; draft: ReportDraft }
  | { kind: "done"; result: CheckResponse; draft: ReportDraft };

interface CheckPayload {
  serviceType: ServiceType;
  pickup: { lat: number; lng: number };
  drop?: { lat: number; lng: number };
  sessionType?: SessionType;
  tripTime?: string;
  quotedPrice: number;
}

const MAX_QUOTE = 100_000;

/** "YYYY-MM-DDTHH:mm" in the device's local time, for <input type="datetime-local">. */
function toLocalInputValue(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

function describeError(err: unknown): { message: string; retryable: boolean } {
  if (err instanceof ApiError) {
    if (err.status === 400 || err.status === 422) return { message: `Please check your entries: ${err.message}`, retryable: false };
    if (err.status === 429) return { message: err.message, retryable: false };
    return { message: err.message, retryable: true };
  }
  return { message: "We couldn't reach the server. Check your connection.", retryable: true };
}

export function FareCheckForm() {
  const [service, setService] = useState<ServiceType | null>(null);
  const [pickup, setPickup] = useState<PlaceChoice | null>(null);
  const [drop, setDrop] = useState<PlaceChoice | null>(null);
  const [session, setSession] = useState<SessionType | null>(null);
  const [timeMode, setTimeMode] = useState<"now" | "custom">("now");
  const [customTime, setCustomTime] = useState("");
  const [quoted, setQuoted] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [demo, setDemo] = useState<DemoScenario | null>(null);

  const isGuide = service === "guide";
  const quotedNumber = Number(quoted);
  const quoteValid = quoted !== "" && quotedNumber > 0 && quotedNumber <= MAX_QUOTE;

  const missing: string[] = [];
  if (!service) missing.push("service");
  if (!pickup) missing.push(isGuide ? "meeting point" : "pickup");
  if (service && !isGuide && !drop) missing.push("drop");
  if (isGuide && !session) missing.push("half or full day");
  if (timeMode === "custom" && !customTime) missing.push("time");
  if (!quoteValid) missing.push("quoted price");

  // Move focus and scroll to the verdict once it arrives.
  useEffect(() => {
    if (status.kind === "done") {
      headingRef.current?.focus({ preventScroll: true });
      headingRef.current?.closest("article")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [status]);

  /** Offline estimate from the pack saved on this phone; false if there's no pack yet. */
  function sendOffline(payload: CheckPayload, draft: ReportDraft): boolean {
    const pack = loadOfflinePack();
    if (!pack) return false;
    try {
      setStatus({ kind: "done", result: offlineCheck(pack, payload), draft });
      return true;
    } catch {
      return false;
    }
  }

  async function send(payload: CheckPayload, draft: ReportDraft) {
    const noPack: Status = {
      kind: "error",
      message: "You're offline, and the rates haven't been saved on this phone yet. Open the app once with a connection.",
      retryable: true,
      payload,
      draft,
    };
    if (isOffline()) {
      if (!sendOffline(payload, draft)) setStatus(noPack);
      return;
    }
    setStatus({ kind: "loading" });
    try {
      const result = await apiJson<CheckResponse>("/api/check", { method: "POST", body: JSON.stringify(payload) });
      reportNetworkOk();
      setStatus({ kind: "done", result, draft });
    } catch (err) {
      // Network down (or server unreachable): fall back to the offline estimate.
      if (isNetworkError(err)) {
        reportNetworkProblem();
        if (!sendOffline(payload, draft)) setStatus(noPack);
        return;
      }
      setStatus({ kind: "error", ...describeError(err), payload, draft });
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (missing.length || !service || !pickup) return;
    void send(
      {
        serviceType: service,
        pickup: { lat: pickup.lat, lng: pickup.lng },
        ...(isGuide ? { sessionType: session ?? undefined } : { drop: drop ? { lat: drop.lat, lng: drop.lng } : undefined }),
        ...(timeMode === "custom" && customTime ? { tripTime: new Date(customTime).toISOString() } : {}),
        quotedPrice: quotedNumber,
      },
      // Handed to the report form if the traveller taps "Report what I paid".
      { serviceType: service, pickup, drop: isGuide ? null : drop, sessionType: isGuide ? session : null, quotedPrice: quotedNumber },
    );
  }

  function applyDemo(s: DemoScenario) {
    setService(s.serviceType);
    setPickup(s.pickup);
    setDrop(s.drop);
    setSession(s.sessionType);
    // 12:00 India time today, shown in the device's own clock, so no night rate whatever the time zone.
    setTimeMode("custom");
    setCustomTime(toLocalInputValue(noonInIndiaToday()));
    setQuoted(String(s.quotedPrice));
    setStatus({ kind: "idle" });
    setDemo(s);
    queueMicrotask(() => document.querySelector<HTMLButtonElement>("button[type=submit]")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  return (
    <div className="space-y-4 px-4 pb-8">
      <DemoPicker onPick={applyDemo} />
      {demo && (
        <p className="rounded-lg bg-brand/10 p-3 text-sm text-brand" role="status">
          Demo filled in: <strong>{demo.title}</strong>. Tap &ldquo;Check this fare&rdquo;.
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <section>
          <h2 className="mb-2 text-sm font-semibold">What are you taking?</h2>
          <ServicePicker value={service} onChange={setService} />
        </section>

        <PlacePicker label={isGuide ? "Meeting point" : "Pickup"} value={pickup} onChange={setPickup} />

        {isGuide ? (
          <fieldset className="rounded-xl border border-line p-3">
            <legend className="px-1 text-sm font-semibold">How long?</legend>
            <div role="radiogroup" aria-label="Guide session" className="grid grid-cols-2 gap-2">
              {(["half_day", "full_day"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={session === s}
                  onClick={() => setSession(s)}
                  className={`min-h-12 rounded-lg border-2 font-medium ${session === s ? "border-brand bg-brand/10 text-brand" : "border-line"}`}
                >
                  {s === "half_day" ? "Half day" : "Full day"}
                </button>
              ))}
            </div>
          </fieldset>
        ) : (
          <PlacePicker label="Drop" value={drop} onChange={setDrop} near={pickup} />
        )}

        <fieldset className="rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-semibold">When?</legend>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-canvas p-1">
            <button
              type="button"
              aria-pressed={timeMode === "now"}
              onClick={() => setTimeMode("now")}
              className={`min-h-11 rounded-md text-sm font-medium ${timeMode === "now" ? "bg-surface text-brand shadow-sm" : "text-muted"}`}
            >
              Now
            </button>
            <button
              type="button"
              aria-pressed={timeMode === "custom"}
              onClick={() => {
                setTimeMode("custom");
                if (!customTime) setCustomTime(toLocalInputValue(new Date()));
              }}
              className={`min-h-11 rounded-md text-sm font-medium ${timeMode === "custom" ? "bg-surface text-brand shadow-sm" : "text-muted"}`}
            >
              Another time
            </button>
          </div>
          {timeMode === "custom" && (
            <>
              <label htmlFor="trip-time" className="sr-only">
                Trip date and time
              </label>
              <input
                id="trip-time"
                type="datetime-local"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="mt-2 min-h-11 w-full rounded-lg border border-line bg-surface px-3"
              />
              <p className="mt-1 text-xs text-muted">Night rates apply from 22:00 to 05:00.</p>
            </>
          )}
        </fieldset>

        <div>
          <label htmlFor="quoted" className="mb-1 block text-sm font-semibold">
            Price you were quoted
          </label>
          <div className="flex items-center rounded-xl border-2 border-line bg-surface focus-within:border-brand">
            <span className="pl-4 text-2xl font-semibold text-muted" aria-hidden="true">
              ₹
            </span>
            <input
              id="quoted"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              placeholder="0"
              value={quoted}
              onChange={(e) => setQuoted(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="min-h-14 w-full rounded-xl bg-transparent px-2 text-2xl font-semibold outline-none"
              aria-describedby="quoted-hint"
            />
          </div>
          <p id="quoted-hint" className="mt-1 text-xs text-muted">
            {quoted !== "" && !quoteValid ? `Enter an amount between ₹1 and ₹${MAX_QUOTE.toLocaleString("en-IN")}.` : "Whole rupees, total for the trip (per seat for a shared Sumo)."}
          </p>
        </div>

        <button
          type="submit"
          disabled={missing.length > 0 || status.kind === "loading"}
          className="min-h-14 w-full rounded-xl bg-brand text-lg font-semibold text-white disabled:opacity-50"
        >
          {status.kind === "loading" ? "Checking…" : "Check this fare"}
        </button>
        {missing.length > 0 && (
          <p className="text-center text-xs text-muted" aria-live="polite">
            Still needed: {missing.join(", ")}
          </p>
        )}
      </form>

      <div aria-live="polite" aria-busy={status.kind === "loading"}>
        {status.kind === "loading" && (
          <div className="animate-pulse space-y-3 rounded-2xl border-2 border-line p-4">
            <div className="h-6 w-1/3 rounded bg-canvas" />
            <div className="h-10 w-2/3 rounded bg-canvas" />
            <p className="text-sm text-muted">Checking the distance, local rates and traveller reports…</p>
          </div>
        )}

        {status.kind === "error" && (
          <div role="alert" className="rounded-2xl border-2 border-risk bg-risk-soft p-4 text-sm">
            <p className="font-semibold text-risk">We couldn&apos;t check this fare.</p>
            <p className="mt-1">{status.message}</p>
            {status.retryable && (
              <button
                type="button"
                onClick={() => void send(status.payload, status.draft)}
                className="mt-3 min-h-11 rounded-lg bg-ink px-4 font-semibold text-white"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {status.kind === "done" && <VerdictCard result={status.result} draft={status.draft} headingRef={headingRef} />}
      </div>
    </div>
  );
}
