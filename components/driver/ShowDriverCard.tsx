"use client";
// Full-screen, high-contrast card the traveller shows to the driver.
// Loaded with next/dynamic only when opened, so the Indic fonts never slow down other pages.
import { Noto_Sans_Bengali, Noto_Sans_Devanagari } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import { formatINR } from "@/lib/format";
import {
  driverCardLanguages,
  driverLine,
  driverText,
  isDriverLanguage,
  type DriverLanguage,
} from "@/lib/i18n/driver-card";
import type { BenchmarkSource, ReportDraft } from "@/lib/types";

const bengali = Noto_Sans_Bengali({ subsets: ["bengali"], variable: "--font-bengali", display: "swap", preload: false });
const devanagari = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-devanagari", display: "swap", preload: false });

/** Script font first, then the app's Latin font for place names, digits and ₹. */
const FONT_STACK: Record<DriverLanguage, string> = {
  en: "var(--font-noto-sans), system-ui, sans-serif",
  as: "var(--font-bengali), var(--font-noto-sans), system-ui, sans-serif",
  bn: "var(--font-bengali), var(--font-noto-sans), system-ui, sans-serif",
  hi: "var(--font-devanagari), var(--font-noto-sans), system-ui, sans-serif",
};

const LANG_KEY = "ttd.driver-lang";

function initialLanguage(): DriverLanguage {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    return isDriverLanguage(saved) ? saved : "en";
  } catch {
    return "en";
  }
}

/** Keeps the screen on while the card is open, where the Wake Lock API exists. */
function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let active = true;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // Denied (e.g. low battery mode): the card still works, the screen may just dim.
      }
    };
    // The browser drops the lock when the tab is hidden; take it again on return.
    const onVisible = () => {
      if (active && document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

export default function ShowDriverCard({
  fairRange,
  trip,
  benchmarkSource,
  onClose,
}: {
  fairRange: { min: number; max: number };
  trip: ReportDraft;
  benchmarkSource: BenchmarkSource;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [lang, setLang] = useState<DriverLanguage>(initialLanguage);
  useWakeLock();

  // Open as a modal: traps focus, Esc closes it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  function choose(code: DriverLanguage) {
    setLang(code);
    try {
      localStorage.setItem(LANG_KEY, code);
    } catch {
      // Not remembered; fine.
    }
  }

  const t = (key: Parameters<typeof driverText>[1]) => driverText(lang, key);
  const isGuide = trip.serviceType === "guide";

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="driver-card-title"
      className={`${bengali.variable} ${devanagari.variable} fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-white p-0 text-black backdrop:bg-black`}
    >
      <div className="mx-auto flex h-full max-w-md flex-col">
        <div className="flex items-center gap-2 border-b-2 border-black p-2">
          <div role="radiogroup" aria-label="Card language" className="grid flex-1 grid-cols-4 gap-1">
            {driverCardLanguages.map((l) => (
              <button
                key={l.code}
                type="button"
                role="radio"
                aria-checked={lang === l.code}
                aria-label={l.name}
                lang={l.code}
                onClick={() => choose(l.code)}
                style={{ fontFamily: FONT_STACK[l.code] }}
                className={`min-h-12 rounded-lg border-2 border-black px-1 text-sm font-semibold ${
                  lang === l.code ? "bg-black text-white" : "bg-white text-black"
                }`}
              >
                {l.nativeName}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-black text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div lang={lang} style={{ fontFamily: FONT_STACK[lang] }} className="flex flex-1 flex-col justify-center gap-5 overflow-y-auto px-5 py-6">
          <h2 id="driver-card-title" className="text-2xl font-bold leading-snug">
            {t("title")}
          </h2>

          {isGuide ? (
            <p className="text-xl font-semibold">
              {t("guide")} · {t(trip.sessionType === "half_day" ? "halfDay" : "fullDay")}
            </p>
          ) : (
            <dl className="space-y-1 text-lg">
              <div>
                <dt className="inline font-semibold">{t("from")}: </dt>
                <dd className="inline" lang="en">
                  {trip.pickup.name}
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold">{t("to")}: </dt>
                <dd className="inline" lang="en">
                  {trip.drop?.name}
                </dd>
              </div>
            </dl>
          )}

          <p className="text-[clamp(3rem,17vw,5.5rem)] font-black leading-none tracking-tight" lang="en">
            {formatINR(fairRange.min)}–{formatINR(fairRange.max)}
          </p>

          <p className="text-2xl font-semibold leading-snug">{driverLine(lang, fairRange.min, fairRange.max)}</p>
          <p className="text-xl">{t("thanks")}</p>
        </div>

        <p className="border-t-2 border-black px-4 py-2 text-xs" lang="en">
          Guide price from Travel Trap Detector{benchmarkSource === "demo_estimate" ? " (demo estimate)" : ""}.
        </p>
      </div>
    </dialog>
  );
}
