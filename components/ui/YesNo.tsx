"use client";

/** Two large radio-style buttons. `value` null means not answered yet. */
export function YesNo({
  label,
  value,
  onChange,
  yesLabel = "Yes",
  noLabel = "No",
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
}) {
  const option = (v: boolean, text: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={value === v}
      onClick={() => onChange(v)}
      className={`min-h-12 rounded-lg border-2 font-medium ${value === v ? "border-brand bg-brand/10 text-brand" : "border-line"}`}
    >
      {text}
    </button>
  );
  return (
    <div>
      <p className="mb-1 text-sm font-semibold" aria-hidden="true">
        {label}
      </p>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
        {option(true, yesLabel)}
        {option(false, noLabel)}
      </div>
    </div>
  );
}
