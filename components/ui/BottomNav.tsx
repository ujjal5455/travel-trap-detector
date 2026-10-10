"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckFareIcon, InfoIcon, MapIcon, ReportIcon } from "./icons";

const ITEMS = [
  { href: "/", label: "Check fare", Icon: CheckFareIcon },
  { href: "/report", label: "Report", Icon: ReportIcon },
  { href: "/map", label: "Map", Icon: MapIcon },
  { href: "/about", label: "About", Icon: InfoIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                  active ? "text-brand" : "text-muted"
                }`}
              >
                <Icon />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
