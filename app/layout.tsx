import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudentSignals",
  description: "Work order dashboard powered by the CriticalAsset API",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
