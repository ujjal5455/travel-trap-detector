"use client";
// Rendered client-only (see ReportPageClient) so it can read the draft from sessionStorage on first render.
import { useState } from "react";
import { ServicePicker } from "@/components/fare-check/ServicePicker";
import { PlacePicker } from "@/components/PlacePicker";
import { parsePrice, PriceInput } from "@/components/ui/PriceInput";
import { YesNo } from "@/components/ui/YesNo";
import { ApiError, apiJson } from "@/lib/client/api";
import { isNetworkError, isOffline, reportNetworkOk, reportNetworkProblem } from "@/lib/client/connectivity";
import { clearReportDraft, loadReportDraft } from "@/lib/client/report-draft";
import { enqueueReport } from "@/lib/client/report-queue";
import { REPORTS } from "@/lib/config";
import type { CreateReportResponse, PlaceChoice, ScamTag, ServiceType, SessionType, UploadUrlResponse } from "@/lib/types";
import { NearbyReports } from "./NearbyReports";
import { PhotoInput } from "./PhotoInput";
import { SavedOffline } from "./SavedOffline";
import { ScamTagPicker } from "./ScamTagPicker";
import { ThankYou } from "./ThankYou";

type Status =
  | { kind: "idle" }
  | { kind: "sending"; step: string }
  | { kind: "error"; message: string }
  | { kind: "done"; id: string; redacted: boolean; pickup: PlaceChoice }
  | { kind: "queued"; hadPhoto: boolean };

async function uploadPhoto(photo: Blob): Promise<string> {
  const { path, signedUrl } = await apiJson<UploadUrlResponse>("/api/reports/upload-url", { method: "POST" });
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "content-type": "image/jpeg", "x-upsert": "false" },
    body: photo,
  });
  if (!res.ok) throw new Error("The photo didn't upload. Remove it or try again.");
  return path;
}

export function ReportForm() {
  const [draft] = useState(loadReportDraft);
  const [service, setService] = useState<ServiceType | null>(draft?.serviceType ?? null);
  const [pickup, setPickup] = useState<PlaceChoice | null>(draft?.pickup ?? null);
  const [drop, setDrop] = useState<PlaceChoice | null>(draft?.drop ?? null);
  const [session, setSession] = useState<SessionType | null>(draft?.sessionType ?? null);
  const [quoted, setQuoted] = useState(draft ? String(draft.quotedPrice) : "");
  const [paid, setPaid] = useState("");
  const [feltFair, setFeltFair] = useState<boolean | null>(null);
  const [isScam, setIsScam] = useState<boolean | null>(null);
  const [tags, setTags] = useState<ScamTag[]>([]);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isGuide = service === "guide";
  const quotedPrice = parsePrice(quoted);
  const paidPrice = parsePrice(paid);

  const missing: string[] = [];
  if (!service) missing.push("service");
  if (!pickup) missing.push(isGuide ? "meeting point" : "pickup");
  if (service && !isGuide && !drop) missing.push("drop");
  if (isGuide && !session) missing.push("half or full day");
  if (isScam === null) missing.push("was this a scam?");
  if (isScam === false && paidPrice === undefined) missing.push("price you paid");
  if (isScam && tags.length === 0) missing.push("what happened");
  if ((quoted !== "" && quotedPrice === undefined) || (paid !== "" && paidPrice === undefined)) missing.push("valid prices");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (missing.length || !service || !pickup || isScam === null) return;
    const payload = {
      serviceType: service,
      pickup: { lat: pickup.lat, lng: pickup.lng },
      ...(isGuide ? { sessionType: session } : { drop: drop ? { lat: drop.lat, lng: drop.lng } : undefined }),
      quotedPrice,
      paidPrice,
      feltFair: feltFair ?? undefined,
      isScam,
      scamTags: isScam ? tags : [],
      description: description.trim() || undefined,
    };

    // No connection: keep it on the phone; ConnectivityManager sends it when the connection returns.
    const saveForLater = async () => {
      try {
        await enqueueReport(JSON.parse(JSON.stringify(payload)) as Record<string, unknown>, photo);
        clearReportDraft();
        setStatus({ kind: "queued", hadPhoto: photo !== null });
        window.scrollTo({ top: 0 });
      } catch (err) {
        setStatus({ kind: "error", message: err instanceof Error ? err.message : "Couldn't save the report on this phone." });
      }
    };
    if (isOffline()) return saveForLater();

    try {
      let photoPath: string | undefined;
      if (photo) {
        setStatus({ kind: "sending", step: "Uploading photo…" });
        photoPath = await uploadPhoto(photo);
      }
      setStatus({ kind: "sending", step: "Saving your report…" });
      const res = await apiJson<CreateReportResponse>("/api/reports", {
        method: "POST",
        body: JSON.stringify({ ...payload, photoPath }),
      });
      reportNetworkOk();
      clearReportDraft();
      setStatus({ kind: "done", id: res.id, redacted: res.redacted, pickup });
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (isNetworkError(err)) {
        reportNetworkProblem();
        return saveForLater();
      }
      const message =
        err instanceof ApiError
          ? err.status === 400
            ? `Please check your entries: ${err.message}`
            : err.message
          : err instanceof Error
            ? err.message
            : "We couldn't reach the server. Check your connection.";
      setStatus({ kind: "error", message });
    }
  }

  if (status.kind === "queued") {
    return <SavedOffline hadPhoto={status.hadPhoto} />;
  }

  if (status.kind === "done") {
    return (
      <ThankYou
        redacted={status.redacted}
        newReportId={status.id}
        pickup={status.pickup}
        hadPhoto={photo !== null}
      />
    );
  }

  const sending = status.kind === "sending";

  return (
    <div className="space-y-6 px-4 pb-8">
      {draft && (
        <p className="rounded-lg bg-brand/10 p-3 text-sm text-brand">Trip details filled in from your fare check. Check them and add what you paid.</p>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <section>
          <h2 className="mb-2 text-sm font-semibold">What did you take?</h2>
          <ServicePicker value={service} onChange={setService} />
        </section>

        <PlacePicker label={isGuide ? "Meeting point" : "Pickup"} value={pickup} onChange={setPickup} />

        {isGuide ? (
          <YesNo label="How long?" value={session === null ? null : session === "full_day"} onChange={(full) => setSession(full ? "full_day" : "half_day")} yesLabel="Full day" noLabel="Half day" />
        ) : (
          <PlacePicker label="Drop" value={drop} onChange={setDrop} near={pickup} />
        )}

        <PriceInput id="report-quoted" label="Price you were quoted" value={quoted} onChange={setQuoted} optional />
        <PriceInput
          id="report-paid"
          label="Price you paid"
          value={paid}
          onChange={setPaid}
          optional={isScam === true}
          hint={isScam ? "Leave empty if you refused and didn't pay." : "Total for the trip (per seat for a shared Sumo)."}
        />

        <YesNo label="Did it feel fair?" value={feltFair} onChange={setFeltFair} />
        <YesNo label="Was this a scam?" value={isScam} onChange={(v) => { setIsScam(v); if (!v) setTags([]); }} yesLabel="Yes, report a problem" noLabel="No" />

        {isScam && <ScamTagPicker value={tags} onChange={setTags} />}

        <div>
          <label htmlFor="report-description" className="mb-1 block text-sm font-semibold">
            Short description <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="report-description"
            rows={3}
            maxLength={REPORTS.descriptionMax}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened? e.g. Asked for extra money for bags after the ride."
            className="w-full rounded-lg border-2 border-line bg-surface p-3 text-sm"
            aria-describedby="report-description-hint"
          />
          <p id="report-description-hint" className="mt-1 flex justify-between gap-2 text-xs text-muted">
            <span>Please don&apos;t include names, phone numbers or vehicle numbers. We remove any we find.</span>
            <span className="shrink-0">
              {description.length}/{REPORTS.descriptionMax}
            </span>
          </p>
        </div>

        <PhotoInput value={photo} onChange={setPhoto} />

        {status.kind === "error" && (
          <div role="alert" className="rounded-xl border-2 border-risk bg-risk-soft p-3 text-sm">
            <p className="font-semibold text-risk">We couldn&apos;t send your report.</p>
            <p className="mt-1">{status.message}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={missing.length > 0 || sending}
          className="min-h-14 w-full rounded-xl bg-brand text-lg font-semibold text-white disabled:opacity-50"
        >
          {sending ? status.step : status.kind === "error" ? "Try again" : "Send report"}
        </button>
        {missing.length > 0 && (
          <p className="text-center text-xs text-muted" aria-live="polite">
            Still needed: {missing.join(", ")}
          </p>
        )}
      </form>

      {pickup && <NearbyReports origin={pickup} />}
    </div>
  );
}
