"use client";
// Hands trip details from the verdict card to the report form through sessionStorage,
// so coordinates never end up in the URL (where they'd be logged and shared).
import type { ReportDraft } from "../types";

const KEY = "ttd.report-draft";

export function saveReportDraft(draft: ReportDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Storage blocked: the form simply starts empty.
  }
}

export function loadReportDraft(): ReportDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ReportDraft) : null;
  } catch {
    return null;
  }
}

export function clearReportDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
