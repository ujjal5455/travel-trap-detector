"use client";

export const MAX_PRICE = 100_000;

/** Rupee amount field: whole rupees, numeric keypad on mobile. `value` is the raw digits string. */
export function PriceInput({
  id,
  label,
  value,
  onChange,
  hint,
  optional = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (digits: string) => void;
  hint?: string;
  optional?: boolean;
}) {
  const n = Number(value);
  const invalid = value !== "" && !(n > 0 && n <= MAX_PRICE);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      <div className="flex items-center rounded-xl border-2 border-line bg-surface focus-within:border-brand">
        <span className="pl-4 text-2xl font-semibold text-muted" aria-hidden="true">
          ₹
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="min-h-14 w-full rounded-xl bg-transparent px-2 text-2xl font-semibold outline-none"
          aria-describedby={`${id}-hint`}
          aria-invalid={invalid}
        />
      </div>
      <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
        {invalid ? `Enter an amount between ₹1 and ₹${MAX_PRICE.toLocaleString("en-IN")}.` : hint}
      </p>
    </div>
  );
}

/** Parses a PriceInput value; undefined when empty or invalid. */
export function parsePrice(value: string): number | undefined {
  const n = Number(value);
  return value !== "" && n > 0 && n <= MAX_PRICE ? n : undefined;
}
