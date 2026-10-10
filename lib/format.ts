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

/** e.g. 6.24 → "6.2 km" */
export function formatKm(km: number): string {
  return `${km.toFixed(1)} km`;
}
