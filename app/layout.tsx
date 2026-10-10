import type { Metadata, Viewport } from "next";
import { SerwistProvider } from "@serwist/turbopack/react";
import { Noto_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { ConnectivityManager } from "@/components/ConnectivityManager";
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
  applicationName: "Travel Trap Detector",
  appleWebApp: { capable: true, title: "Trap Detector", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
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
        {/* Service worker only in production builds; reloadOnOnline is off so returning online doesn't wipe the screen. */}
        <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === "development"} reloadOnOnline={false}>
          <TopBar />
          <ConnectivityManager />
          <div className="mx-auto min-h-[calc(100dvh-3rem)] max-w-md bg-surface pb-20">{children}</div>
          <BottomNav />
        </SerwistProvider>
      </body>
    </html>
  );
}
