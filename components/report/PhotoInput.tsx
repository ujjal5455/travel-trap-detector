"use client";
// Optional evidence photo. Compressed in the browser; never previewed or shown publicly,
// only "evidence attached" (docs/SPEC.md privacy rule).
import { useId, useState } from "react";
import { compressImage } from "@/lib/client/compress-image";

export function PhotoInput({ value, onChange }: { value: Blob | null; onChange: (photo: Blob | null) => void }) {
  const id = useId();
  const [state, setState] = useState<{ kind: "idle" } | { kind: "working" } | { kind: "error"; message: string }>({
    kind: "idle",
  });

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setState({ kind: "error", message: "Please choose a photo (JPEG, PNG or similar)." });
      return;
    }
    setState({ kind: "working" });
    try {
      onChange(await compressImage(file));
      setState({ kind: "idle" });
    } catch (err) {
      onChange(null);
      setState({ kind: "error", message: err instanceof Error ? err.message : "Couldn't process that photo." });
    }
  }

  return (
    <div>
      <p className="mb-1 text-sm font-semibold">
        Photo evidence <span className="font-normal text-muted">(optional)</span>
      </p>
      {value ? (
        <div className="flex min-h-12 items-center justify-between rounded-lg border-2 border-line px-3 text-sm">
          <span>
            <span aria-hidden="true">📎 </span>Evidence attached ({Math.round(value.size / 1024)} KB)
          </span>
          <button type="button" onClick={() => onChange(null)} className="min-h-11 px-2 font-medium text-risk">
            Remove
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-line px-3 text-sm font-medium"
        >
          {state.kind === "working" ? "Shrinking photo…" : "Add a photo (receipt, meter, signboard)"}
          <input
            id={id}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={state.kind === "working"}
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      )}
      <p className="mt-1 text-xs text-muted" aria-live="polite">
        {state.kind === "error"
          ? state.message
          : "Photos stay private: they're stored securely and never shown to other users. Location data in the photo is removed."}
      </p>
    </div>
  );
}
