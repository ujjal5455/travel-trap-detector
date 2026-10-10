import type { Metadata, Viewport } from "next";
import { Noto_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { TopBar } from "@/components/ui/TopBar";
import "./globals.css";

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Travel Trap Detector",
    template: "%s · Travel Trap Detector",
  },
  description:
    "Check if a taxi, auto, bike taxi, shared Sumo or guide price in North East India is fair, with a clear explanation.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

// Plain children type (not Next's generated LayoutProps) so `npx tsc --noEmit` passes on a fresh clone.
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${notoSans.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        <TopBar />
        <div className="mx-auto min-h-[calc(100dvh-3rem)] max-w-md bg-surface pb-20">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
