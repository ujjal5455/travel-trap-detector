"use client";

import { SCAM_TAG_LABELS } from "@/lib/labels";
import { SCAM_TAGS, type ScamTag } from "@/lib/types";

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ScamTagPicker({ value, onChange }: { value: ScamTag[]; onChange: (tags: ScamTag[]) => void }) {
  const toggle = (tag: ScamTag) => onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold">What happened? (choose all that apply)</legend>
      <div className="flex flex-wrap gap-2">
        {SCAM_TAGS.map((tag) => {
          const on = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(tag)}
              className={`min-h-11 rounded-full border-2 px-3 text-sm font-medium ${
                on ? "border-risk bg-risk-soft text-risk" : "border-line text-ink"
              }`}
            >
              {on && <span aria-hidden="true">✓ </span>}
              {capitalise(SCAM_TAG_LABELS[tag])}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
