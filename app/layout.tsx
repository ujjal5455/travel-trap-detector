import type { Metadata, Viewport } from "next";
import { Noto_Sans } from "next/font/google";
import { BottomNav } from "@/components/ui/BottomNav";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${notoSans.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        <div className="mx-auto min-h-dvh max-w-md bg-surface pb-20">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
