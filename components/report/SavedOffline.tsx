"use client";

import Link from "next/link";

/** Shown when a report was saved on the phone because there was no connection. */
export function SavedOffline({ hadPhoto }: { hadPhoto: boolean }) {
  return (
    <div className="px-4 pb-8">
      <section className="rounded-2xl border-2 border-brand bg-brand/10 p-4" aria-labelledby="saved-title">
        <h2 id="saved-title" className="text-xl font-bold text-brand">
          <span aria-hidden="true">📥 </span>Report saved on your phone
        </h2>
        <p className="mt-2 text-sm">
          You&apos;re offline, so we&apos;ll send it automatically as soon as you&apos;re back online{hadPhoto ? ", photo included" : ""}.
          Keep the app open or come back to it later; you don&apos;t need to do anything else.
        </p>
        <div className="mt-4 grid gap-2">
          <Link href="/" className="flex min-h-12 items-center justify-center rounded-xl bg-brand px-4 font-semibold text-white">
            Check a fare
          </Link>
          <a href="/report" className="flex min-h-12 items-center justify-center rounded-xl border-2 border-line bg-surface px-4 font-semibold">
            Send another report
          </a>
        </div>
      </section>
    </div>
  );
}
