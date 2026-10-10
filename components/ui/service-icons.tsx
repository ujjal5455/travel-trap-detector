// Simple inline line icons for each service type (no icon library, no images).
import type { SVGProps } from "react";
import type { ServiceType } from "@/lib/types";

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={32}
      height={32}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const SERVICE_ICONS: Record<ServiceType, (props: IconProps) => React.ReactElement> = {
  // Auto-rickshaw: canopy, open side, three wheels
  auto: (p) => (
    <Svg {...p}>
      <path d="M5 22V13a6 6 0 0 1 6-6h9l5 7v8" />
      <path d="M5 14h20" />
      <path d="M12 7v7" />
      <circle cx="9" cy="23" r="2.5" />
      <circle cx="23" cy="23" r="2.5" />
      <path d="M11.5 23h9" />
    </Svg>
  ),
  // Car with roof sign
  taxi: (p) => (
    <Svg {...p}>
      <path d="M13 7h6v3" />
      <path d="M4 21v-5l3-6h18l3 6v5H4Z" />
      <path d="M4 16h24" />
      <circle cx="9.5" cy="22" r="2.5" />
      <circle cx="22.5" cy="22" r="2.5" />
    </Svg>
  ),
  // Motorbike
  bike_taxi: (p) => (
    <Svg {...p}>
      <circle cx="7" cy="21" r="4" />
      <circle cx="25" cy="21" r="4" />
      <path d="M7 21l5-8h7l6 8" />
      <path d="M16 13l-2-4h-3" />
      <path d="M19 13l2-4h3" />
    </Svg>
  ),
  // Tall jeep / Sumo with roof rack
  shared_sumo: (p) => (
    <Svg {...p}>
      <path d="M7 6h16" />
      <path d="M3 21V11a3 3 0 0 1 3-3h17l5 6v7H3Z" />
      <path d="M3 14h25" />
      <path d="M11 8v6M18 8v6" />
      <circle cx="9" cy="22" r="2.5" />
      <circle cx="22" cy="22" r="2.5" />
    </Svg>
  ),
  // Person holding a small flag
  guide: (p) => (
    <Svg {...p}>
      <circle cx="13" cy="7" r="3" />
      <path d="M8 27v-7l-2-1v-5a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v5l-2 1v7" />
      <path d="M23 27V5" />
      <path d="M23 5h6l-2 3 2 3h-6" />
    </Svg>
  ),
};
