const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Whole rupees with Indian digit grouping, e.g. ₹1,00,000. */
export function formatINR(amount: number): string {
  return inr.format(amount);
}

export function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** e.g. 2.08 → "2.1×" */
export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(1)}×`;
}

/** "today", "yesterday", "3 days ago", "2 weeks ago", "4 months ago" */
export function formatTimeAgo(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/** 340 → "340 m", 1200 → "1.2 km" */
export function formatMeters(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

/** e.g. 6.24 → "6.2 km" */
export function formatKm(km: number): string {
  return `${km.toFixed(1)} km`;
}

/** A safe outbound link to a fare source: https only, with the bare host name for the label. */
export function sourceLink(url: string | null | undefined): { href: string; host: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    return { href: u.href, host: u.hostname.replace(/^www\./, "") };
  } catch {
    return null;
  }
}
