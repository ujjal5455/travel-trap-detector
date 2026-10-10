import Link from "next/link";

export function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-brand text-white">
      <div className="mx-auto flex h-12 max-w-md items-center px-4">
        <Link href="/" className="flex min-h-11 items-center gap-2 font-bold tracking-tight">
          <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" />
            <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Travel Trap Detector
        </Link>
      </div>
    </header>
  );
}
